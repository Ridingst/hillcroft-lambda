/*

This function will timeout on the Vercel platform but it can be used in the AWS serverless platform

Invoices = subscription products
CheckoutSessions = one off purchases
PaymentIntents = summer session purchases

*/

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

var _ = require('underscore');

exports.handler = async (event) => {
    console.log('Function started');
    console.log(event.headers)
    
    if(("x-api-key" in event.headers) && event.headers['x-api-key'] == process.env.API_KEY){
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
                    date: item.expires_at
                };
            });
        })
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
    } else {
        return {
            statusCode: 400,
            body: 'Unauthorised'
        }
    }
};
