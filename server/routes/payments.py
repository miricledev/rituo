from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import stripe
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Stripe with live key
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Get product and price IDs from environment variables
CHALLENGE_PRODUCT_ID = os.getenv('STRIPE_CHALLENGE_PRODUCT_ID')
CHALLENGE_PRICE_ID = os.getenv('STRIPE_CHALLENGE_PRICE_ID')

payments_bp = Blueprint('payments', __name__)

@payments_bp.route('/create-payment-intent', methods=['POST'])
@jwt_required()
def create_payment_intent():
    try:
        # Get the current user
        user_id = get_jwt_identity()
        
        # Create a PaymentIntent with the order amount and currency
        intent = stripe.PaymentIntent.create(
            amount=299,  # Amount in pence/cents (£2.99)
            currency='gbp',
            metadata={
                'user_id': user_id,
                'product_id': CHALLENGE_PRODUCT_ID,
                'price_id': CHALLENGE_PRICE_ID
            },
            automatic_payment_methods={
                'enabled': True,
            },
            receipt_email=request.json.get('email'),  # Optional: Add if you want to send receipts
        )
        
        return jsonify({
            'clientSecret': intent.client_secret,
            'productId': CHALLENGE_PRODUCT_ID,
            'priceId': CHALLENGE_PRICE_ID
        })
    except Exception as e:
        print(f"Error creating payment intent: {str(e)}")
        return jsonify({'error': str(e)}), 500

@payments_bp.route('/verify-payment', methods=['POST'])
@jwt_required()
def verify_payment():
    try:
        data = request.get_json()
        payment_intent_id = data.get('paymentIntentId')
        
        # Retrieve the PaymentIntent
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status == 'succeeded':
            # Payment was successful
            return jsonify({
                'success': True,
                'message': 'Payment successful',
                'productId': intent.metadata.get('product_id'),
                'priceId': intent.metadata.get('price_id')
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Payment not successful'
            }), 400
            
    except Exception as e:
        print(f"Error verifying payment: {str(e)}")
        return jsonify({'error': str(e)}), 500 