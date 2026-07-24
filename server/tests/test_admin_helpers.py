import re
import unittest

from routes.admin import _temporary_password_for_role


class AdminHelperTests(unittest.TestCase):
    def test_student_temporary_password_is_six_digits(self):
        passwords = {_temporary_password_for_role('student') for _ in range(25)}

        self.assertEqual(len(passwords), 25)
        self.assertTrue(all(re.fullmatch(r'\d{6}', password) for password in passwords))

    def test_staff_temporary_password_is_strong(self):
        for account_role in ('teacher', 'admin'):
            password = _temporary_password_for_role(account_role)

            self.assertGreaterEqual(len(password), 8)
            self.assertFalse(re.fullmatch(r'\d{6}', password))


if __name__ == '__main__':
    unittest.main()
