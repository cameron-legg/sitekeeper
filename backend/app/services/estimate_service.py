# Compatibility shim
from app.utilities.estimates.service import *  # noqa: F401,F403
from app.utilities.estimates.service import EstimateService, NotFoundError, compute_line_item_totals, compute_totals_with_tax  # noqa: F401
