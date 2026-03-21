"""Flask application factory."""

from flask import Flask
from flask_cors import CORS

from backend.routes.personas import bp as personas_bp
from backend.routes.agent_routes import bp as agent_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5001"])

    app.register_blueprint(personas_bp)
    app.register_blueprint(agent_bp)

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5001, debug=True, threaded=True)
