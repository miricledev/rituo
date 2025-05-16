from werkzeug.security import generate_password_hash
from db.models import db, User
from server import app

EMAIL = 'seeduser@example.com'
NEW_PASSWORD = 'password123'

if __name__ == "__main__":
    with app.app_context():
        user = User.query.filter_by(email=EMAIL).first()
        if not user:
            print(f"User with email {EMAIL} not found.")
        else:
            user.password_hash = generate_password_hash(NEW_PASSWORD)
            db.session.commit()
            print(f"Password for {EMAIL} set to '{NEW_PASSWORD}'!") 