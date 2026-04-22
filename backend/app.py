"""
Flask application factory for the Agentic Tax Filler backend.

This file is the entry point for the entire backend server. It uses the
"application factory" pattern, which is the recommended way to set up a
Flask application. Instead of creating the Flask app at module level
(which makes testing and configuration harder), we wrap all the setup
inside a ``create_app()`` function that can be called on demand.

Architecture overview
---------------------
The backend exposes a REST API that the React frontend calls.
There are two groups of endpoints (called "blueprints" in Flask):

1. **Personas** (``/api/personas``) -- list, get, and create taxpayer
   profiles (personas) that the agent will file taxes for.
2. **Agent sessions** (``/api/sessions``) -- create an AI agent session,
   run the agent, stream progress events in real time, retrieve the
   filled form, and get a correctness score.

A simple ``/ping`` health-check endpoint is also registered so that
the frontend (or monitoring tools) can verify the server is alive.
"""

from flask import Flask
from flask_cors import CORS

# Import the two Blueprint modules that define our REST API routes.
# A Blueprint is Flask's way of organizing related routes into reusable modules.
from backend.routes.personas import bp as personas_bp
from backend.routes.agent_routes import bp as agent_bp


def create_app() -> Flask:
    """
    Create and configure a new Flask application instance.

    This function:
    1. Creates a Flask app object.
    2. Enables CORS (Cross-Origin Resource Sharing) so that the React
       frontend, which runs on a different port during development,
       is allowed to make requests to this backend.
    3. Registers the two route blueprints (personas and agent sessions).
    4. Adds a lightweight ``/ping`` health-check endpoint.

    Returns
    -------
    Flask
        A fully configured Flask application, ready to handle requests.
    """
    app = Flask(__name__)

    # CORS setup: The frontend dev server typically runs on port 5173 (Vite)
    # or 3000 (Create React App). We explicitly whitelist those origins so
    # the browser allows cross-origin fetch/XHR requests.
    CORS(app, origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5001"])

    # Register route blueprints -- this connects the URL routes defined
    # in each blueprint module to our Flask app.
    app.register_blueprint(personas_bp)
    app.register_blueprint(agent_bp)

    # A minimal health-check endpoint. Calling GET /ping returns {"status": "ok"}
    # with HTTP 200. Useful for verifying the server is running.
    app.add_url_rule("/ping", "ping", lambda: ({"status": "ok"}, 200))

    return app


# When this file is executed directly (e.g., `python -m backend.app`),
# start the development server on all network interfaces (0.0.0.0),
# port 5001, with debug mode and threading enabled so it can handle
# multiple requests at the same time (important for SSE streaming).
if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5001, debug=True, threaded=True)
