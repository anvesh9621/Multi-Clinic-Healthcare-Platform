from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError


def custom_exception_handler(exc, context):
    """
    Global exception handler for API.
    """

    # Let DRF handle known exceptions first
    response = exception_handler(exc, context)

    if response is not None:
        return Response(
            {
                "success": False,
                "errors": response.data
            },
            status=response.status_code
        )

    # Handle database integrity errors (like booking conflicts)
    if isinstance(exc, IntegrityError):
        return Response(
            {
                "success": False,
                "message": "Database integrity error."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Handle validation/business logic errors
    if isinstance(exc, ValueError):
        return Response(
            {
                "success": False,
                "message": str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Fallback for unexpected errors
    raise exc
    # return Response(
    #     {
    #         "success": False,
    #         "message": "Internal server error."
    #     },
    #     status=status.HTTP_500_INTERNAL_SERVER_ERROR
    # )