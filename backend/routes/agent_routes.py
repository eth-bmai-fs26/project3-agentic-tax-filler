"""Agent session routes — create, run, stream (SSE), form state, score."""

import json
import queue

from flask import Blueprint, Response, jsonify, request, stream_with_context

from backend.services import agent_service

bp = Blueprint("agent", __name__, url_prefix="/api/sessions")


# ── Create session ───────────────────────────────────────────────────────────

@bp.route("/", methods=["POST"])
@bp.route("", methods=["POST"])
def create_session():
    body = request.get_json(silent=True) or {}
    persona = body.get("persona", "")
    if not persona:
        return jsonify({"error": "persona is required"}), 400
    try:
        session = agent_service.create_session(persona)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({
        "session_id": session.session_id,
        "persona": session.persona,
        "status": session.status,
    }), 201


# ── Get session ──────────────────────────────────────────────────────────────

@bp.route("/<session_id>", methods=["GET"])
def get_session(session_id: str):
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
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
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
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    def generate():
        while True:
            try:
                event = session.sse_queue.get(timeout=25)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("agent_done", "agent_error"):
                    break
            except queue.Empty:
                yield 'data: {"type":"heartbeat"}\n\n'
                if session.status in ("done", "error"):
                    break

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Form state ───────────────────────────────────────────────────────────────

@bp.route("/<session_id>/form", methods=["GET"])
def get_form(session_id: str):
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session.bridge.get_form_data())


# ── Score ────────────────────────────────────────────────────────────────────

@bp.route("/<session_id>/score", methods=["GET"])
def get_score(session_id: str):
    session = agent_service.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session.status != "done":
        return jsonify({"error": "Session not done yet", "status": session.status}), 409
    return jsonify(session.score or {})


# ── Delete session ───────────────────────────────────────────────────────────

@bp.route("/<session_id>", methods=["DELETE"])
def delete_session(session_id: str):
    deleted = agent_service.delete_session(session_id)
    if not deleted:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"deleted": True})
