"""
REST API routes for managing AI agent sessions.

This module defines the HTTP endpoints that the React frontend calls to:
  1. **Create** a new agent session for a given taxpayer persona.
  2. **Run** the AI agent (starts filling the tax form in the background).
  3. **Stream** real-time progress updates to the frontend using
     Server-Sent Events (SSE).
  4. **Retrieve** the current form state (all fields the agent has filled).
  5. **Score** the agent's submission against the ground-truth answers.
  6. **Delete** a session when it is no longer needed.

All routes are grouped under the URL prefix ``/api/sessions`` using a
Flask Blueprint.

How it fits into the project
----------------------------
These routes act as the "controller" layer.  They validate incoming
HTTP requests, delegate the real work to ``agent_service`` (the
"service" layer), and return JSON responses.  The frontend never talks
to ``agent_service`` directly -- it always goes through these endpoints.

Key concepts for beginners
--------------------------
- **Blueprint**: Flask's way of organizing related routes into a
  reusable module that can be registered on the main app.
- **SSE (Server-Sent Events)**: A browser-native protocol where the
  server keeps an HTTP connection open and pushes text events to the
  client.  We use it so the frontend can show live agent logs.
- **HTTP status codes**: 200 = OK, 201 = Created, 202 = Accepted
  (work started), 400 = Bad Request, 404 = Not Found, 409 = Conflict,
  500 = Internal Server Error.
"""

import json
import queue

from flask import Blueprint, Response, jsonify, request, stream_with_context

from backend.services import agent_service

# Create a Blueprint named "agent" with all routes starting at /api/sessions.
bp = Blueprint("agent", __name__, url_prefix="/api/sessions")


# ── Create session ───────────────────────────────────────────────────────────

@bp.route("/", methods=["POST"])
@bp.route("", methods=["POST"])
def create_session():
    """
    Create a new agent session for a given persona.

    Expects a JSON body like ``{"persona": "anna_meier"}``.
    Returns the newly created session's ID, persona name, and status.

    HTTP responses:
        201 -- session created successfully
        400 -- missing or unknown persona name
    """
    # Parse the JSON body from the request.  ``silent=True`` means it
    # returns None instead of raising an error if the body is not JSON.
    body = request.get_json(silent=True) or {}
    persona = body.get("persona", "")
    if not persona:
        return jsonify({"error": "persona is required"}), 400
    try:
        session = agent_service.create_session(persona)
    except ValueError as exc:
        # create_session raises ValueError if the persona name is invalid
        return jsonify({"error": str(exc)}), 400
    return jsonify({
        "session_id": session.session_id,
        "persona": session.persona,
        "status": session.status,
    }), 201


# ── Get session ──────────────────────────────────────────────────────────────

@bp.route("/<session_id>", methods=["GET"])
def get_session(session_id: str):
    """
    Retrieve metadata about an existing session.

    The frontend calls this to check whether a session is still running,
    has finished, or encountered an error.

    Path parameter:
        session_id -- UUID string identifying the session

    HTTP responses:
        200 -- session found, returns its metadata
        404 -- no session with that ID exists
    """
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({
        "session_id": session.session_id,
        "persona": session.persona,
        "status": session.status,
        "error": session.error,
    })


# ── Start agent run ──────────────────────────────────────────────────────────

@bp.route("/<session_id>/run", methods=["POST"])
def run_session(session_id: str):
    """
    Start the AI agent for an existing session.

    The agent runs in a background thread so that this endpoint returns
    immediately (HTTP 202 Accepted).  The frontend can then connect to
    the ``/stream`` endpoint to watch progress in real time.

    HTTP responses:
        202 -- agent started successfully
        404 -- session not found
        409 -- agent is already running for this session
        500 -- unexpected error while starting the agent
    """
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    # Prevent double-starting: if the agent is already running, return 409 Conflict
    if session.status == "running":
        return jsonify({"error": "Already running"}), 409
    try:
        agent_service.run_session(session_id)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"status": "started"}), 202


# ── SSE stream ───────────────────────────────────────────────────────────────

@bp.route("/<session_id>/stream", methods=["GET"])
def stream_session(session_id: str):
    """
    Stream real-time agent events to the frontend using Server-Sent Events.

    The frontend connects to this endpoint with ``new EventSource(url)``
    and receives JSON events like:
      - ``{"type": "log", "message": "..."}``        -- progress log line
      - ``{"type": "fill_field", "locator": "...", ...}`` -- field was filled
      - ``{"type": "navigate", "to_page": "..."}``   -- page changed
      - ``{"type": "agent_done", "score_percent": N}`` -- agent finished
      - ``{"type": "agent_error", "error": "..."}``  -- agent crashed
      - ``{"type": "heartbeat"}``                    -- keep-alive ping

    The stream ends when the agent finishes (done/error) or the client
    disconnects.

    HTTP responses:
        200 -- SSE stream (content-type: text/event-stream)
        404 -- session not found
    """
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    def generate():
        """
        Generator that yields SSE-formatted lines.

        It blocks on the session's SSE queue waiting for events.  If no
        event arrives within 25 seconds, it sends a heartbeat to keep the
        HTTP connection alive (browsers/proxies may close idle connections).
        """
        while True:
            try:
                # Wait up to 25 seconds for the next event from the agent
                event = session.sse_queue.get(timeout=25)
                # Format as SSE: "data: <json>\n\n"
                yield f"data: {json.dumps(event)}\n\n"
                # If this was a terminal event, stop the stream
                if event.get("type") in ("agent_done", "agent_error"):
                    break
            except queue.Empty:
                # No event within 25s -- send a heartbeat to keep the
                # connection alive and check if the session ended while
                # we were waiting
                yield 'data: {"type":"heartbeat"}\n\n'
                if session.status in ("done", "error"):
                    break

    # stream_with_context keeps the Flask request context alive for the
    # duration of the generator (needed for thread-safety).
    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",          # Prevent caching of the stream
            "X-Accel-Buffering": "no",             # Disable Nginx buffering (if present)
            "Connection": "keep-alive",            # Keep the TCP connection open
        },
    )


# ── Form state ───────────────────────────────────────────────────────────────

@bp.route("/<session_id>/form", methods=["GET"])
def get_form(session_id: str):
    """
    Return the current form state for a session.

    The frontend polls this endpoint to display the tax form with all
    the values the agent has filled so far.  The response is a nested
    JSON object mirroring the form structure (personal, income,
    deductions, wealth, etc.).

    HTTP responses:
        200 -- returns the form data dict
        404 -- session not found
    """
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session.bridge.get_form_data())


# ── Score ────────────────────────────────────────────────────────────────────

@bp.route("/<session_id>/score", methods=["GET"])
def get_score(session_id: str):
    """
    Return the accuracy score for a completed session.

    The score is computed by comparing the agent's submitted form data
    against a ``ground_truth.json`` file that contains the correct answers
    for the persona.  The response includes overall percentage, counts of
    correct/wrong/missing/extra fields, and a detailed error list.

    HTTP responses:
        200 -- returns the score object
        404 -- session not found
        409 -- session has not finished yet (still running or idle)
    """
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session.status != "done":
        return jsonify({"error": "Session not done yet", "status": session.status}), 409
    return jsonify(session.score or {})


# ── Delete session ───────────────────────────────────────────────────────────

@bp.route("/<session_id>", methods=["DELETE"])
def delete_session(session_id: str):
    """
    Delete a session and free its resources.

    HTTP responses:
        200 -- session deleted
        404 -- session not found
    """
    deleted = agent_service.delete_session(session_id)
    if not deleted:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"deleted": True})
