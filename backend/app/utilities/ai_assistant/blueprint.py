"""AI assistant blueprint.

Routes:
    POST /api/v1/ai/chat — Send a message to the AI assistant
"""

from flask import Blueprint, current_app, g, jsonify, request

from ...core.auth.decorators import auth_required
from ...core.blueprints.helpers import error_response

ai_bp = Blueprint("ai", __name__)


@ai_bp.post("/ai/chat")
@auth_required
def chat():
    """Process an AI chat message.

    Request body:
        {
            "messages": [{"role": "user"|"assistant", "content": "..."}],
            "screen_context": {"screen": "ScreenName", "params": {...}}
        }

    Response:
        {
            "response": "AI text response",
            "actions": [{"tool": "...", "args": {...}, "result": {...}}]
        }
    """
    data = request.get_json(silent=True) or {}

    messages = data.get("messages")
    if not messages or not isinstance(messages, list):
        return error_response("VALIDATION_ERROR", "messages is required and must be a list.", "messages")

    screen_context = data.get("screen_context", {"screen": "Home", "params": {}})

    # Get OpenAI API key from config
    api_key = current_app.config.get("OPENAI_API_KEY")
    if not api_key:
        return error_response("CONFIG_ERROR", "AI features are not configured. Set OPENAI_API_KEY.", status=503)

    # Unexpected errors propagate to the global handler for logging.
    from .service import AIService

    ai_service = AIService(
        api_key=api_key,
        model=current_app.config.get("OPENAI_MODEL", "gpt-4.1-mini"),
    )
    result = ai_service.chat(
        user_id=g.current_user_id,
        messages=messages,
        screen_context=screen_context,
    )
    return jsonify(result), 200
