"""AI assistant blueprint.

Routes:
    POST /api/v1/ai/chat — Send a message to the AI assistant
"""

from flask import Blueprint, current_app, g, jsonify, request

from ..auth.decorators import auth_required
from .helpers import error_response, server_error

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

    try:
        from ..services.ai_service import AIService

        ai_service = AIService(
            api_key=api_key,
            model=current_app.config.get("OPENAI_MODEL", "gpt-4o-mini"),
        )
        result = ai_service.chat(
            user_id=g.current_user_id,
            messages=messages,
            screen_context=screen_context,
        )
        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f"AI chat error: {e}")
        return server_error()
