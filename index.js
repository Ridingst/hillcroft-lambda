/*

This function will timeout on the Vercel platform but it can be used in the AWS serverless platform

Demo edit

Invoices = subscription products
CheckoutSessions = one off purchases
PaymentIntents = summer session purchases

It will automatically deploy to AWS Lambda on commit to main branch.

Accepts two parameters passed as headers
x-api-key = Authentication key
mode = [oneOff, subscription] can retrieve oneOff or subscription Payments.

*/

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

var _ = require('underscore');

exports.handler = async (event) => {
    console.log('Function started');

    var mode = ''
    if('mode' in event.headers){ mode = event.headers.mode;}
    
    if(("x-api-key" in event.headers) && event.headers['x-api-key'] == process.env.API_KEY){
        switch(mode){

            case 'oneOff':
                console.log('Running in ONEOFF mode');
                return getOneOff()
                    .then(function(data){
                        console.log("Return data");
                        return { statusCode: 200, body: data };   
                    })
                    .catch(err => {
                        console.error((err));
                        return {
                            statusCode: 400,
                            body: "Error fetching purchases."
                        };
                    });
                break;
            
            case 'subscription':
                console.log('Running in SUBSCRIPTION mode')
                return getSubcription()
                    .then(function(data){
                        console.log("Return data");
                        return { statusCode: 200, body: data };   
                    })
                    .catch(err => {
                        console.error((err));
                        return {
                            statusCode: 400,
                            body: "Error fetching purchases."
                        };
                    });
                break;

            case 'combined':
                console.log('Running in COMBINED mode')
                return getCombined()
                    .then(function(data){
                        console.log("Return data");
                        return { statusCode: 200, body: data };   
                    })
                    .catch(err => {
                        console.error((err));
                        return {
                            statusCode: 400,
                            body: "Error fetching purchases."
                        };
                    });
                break;

            case 'summersessions':
                console.log('Running in SUMMERSESSIONS mode')
                return getSummerSessions()
                    .then(function(data){
                        console.log("Return data");
                        return { statusCode: 200, body: data };   
                    })
                    .catch(err => {
                        console.error((err));
                        return {
                            statusCode: 400,
                            body: "Error fetching purchases."
                        };
                    });
                break;
            
            default:
                console.log('Mode unknown, defaulting to COMBINED mode')
                return getCombined()
                    .then(function(data){
                        console.log("Return data");
                        return { statusCode: 200, body: data };   
                    })
                    .catch(err => {
                        console.error((err));
                        return {
                            statusCode: 400,
                            body: "Error fetching purchases."
                        };
                    });
        }

    } else {
        return {
            statusCode: 400,
            body: 'Unauthorised'
        }
    }
        
};

function getCombined(){
    var subscription = getSubcription();
    var oneOff = getOneOff();

    return Promise.all([subscription, oneOff])
    .then(data => {
        return data[0].concat(data[1])
    })
}

function getOneOff(){
    return stripe.checkout.sessions.list({limit:100, expand: ['data.line_items', 'data.customer']})
        .autoPagingToArray({limit: 10000})
        .then(data => {
            console.log('Filtering results to only paid');
            return data.filter(item => item.payment_status == "paid");
        })
        .then(data =>{
            console.log("Mapping returned data to normalised format");
            return _.map(data, function(item){
                return {
                    customer: item.customer.id,
                    customer_email: item.customer.email,
                    customer_name: item.customer.name,
                    amount_paid: item.amount_total,
                    customer_phone: item.customer.phone,
                    product: item.line_items.data[0].description,
                    product_id: item.line_items.data[0].price.product,
                    date: new Date(item.expires_at*1000)
                };
            });
        })
}

function getSubcription(){
    return stripe.invoices.list({limit:100, status: 'paid', expand: ['data.customer']})
        .autoPagingToArray({limit: 10000})
        .then(data =>{
            console.log("Mapping returned data to normalised format");
            return _.map(data, function(item){
                return {
                    customer: item.customer.id,
                    customer_email: item.customer.email,
                    customer_name: item.customer.name,
                    amount_paid: item.amount_paid,
                    customer_phone: item.customer.phone,
                    product: item.lines.data[0].description,
                    product_id: item.lines.data[0].price.product,
                    date: new Date(item.status_transitions.paid_at*1000)
                };
            });
        })
}


function getSummerSessions(){
    return stripe.paymentIntents.list({limit:100, expand: ['data.customer']})
        .autoPagingToArray({limit: 100})
        .then(data=> {
            console.log('Filtering PaymentIntents to just summer sessions')
            return _.filter(data, function(item){
                return (item.description && item.description.includes('Ticket Sale -') && item.status =="succeeded")
            })
        })
        .then(data =>{
            console.log("Mapping returned data to normalised format");
            return _.map(data, function(item){

                let name = ''
            
                try{
                    name = item.charges.data[0].billing_details.name
                } catch {
                    name = "Guest"
                }

                return {
                    customer: 'Guest',
                    customer_email: item.receipt_email || 'Guest',
                    customer_name: name,
                    amount_paid: item.amount,
                    customer_phone: '',
                    product: item.description,
                    product_id: item.description,
                    date: new Date(item.created*1000)
                };
            });
            //return data
        })
}