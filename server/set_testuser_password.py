from server import app
from db.models import db, User
from werkzeug.security import generate_password_hash

# Set this to whatever password you want
PASSWORD = "test123"

if __name__ == "__main__":
    with app.app_context():
        user = User.query.filter_by(username='testuser').first()
        if user:
            user.password_hash = generate_password_hash(PASSWORD)
            db.session.commit()
            print(f"Password updated for testuser to: {PASSWORD}")
        else:
            print("testuser not found!") 