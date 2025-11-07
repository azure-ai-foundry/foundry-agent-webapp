namespace WebApp.Api.Models;

/// <summary>
/// Structured error response following RFC 7807 Problem Details pattern.
/// Provides consistent error format across all API endpoints.
/// </summary>
public record ErrorResponse
{
    /// <summary>
    /// A URI reference that identifies the problem type
    /// </summary>
    public string Type { get; init; } = "about:blank";

    /// <summary>
    /// A short, human-readable summary of the problem type
    /// </summary>
    public required string Title { get; init; }

    /// <summary>
    /// A human-readable explanation specific to this occurrence of the problem
    /// </summary>
    public string? Detail { get; init; }

    /// <summary>
    /// The HTTP status code
    /// </summary>
    public int Status { get; init; }

    /// <summary>
    /// Additional context-specific properties
    /// </summary>
    public Dictionary<string, object?>? Extensions { get; init; }
}

/// <summary>
/// Helper class for creating standardized error responses.
/// Sanitizes error details in production to prevent information leakage.
/// </summary>
public static class ErrorResponseFactory
{
    /// <summary>
    /// Create a user-friendly error response from an exception.
    /// In production, generic messages are used to avoid leaking internal details.
    /// </summary>
    public static ErrorResponse CreateFromException(
        Exception exception, 
        int statusCode, 
        bool isDevelopment = false)
    {
        var (title, detail) = GetErrorMessages(statusCode, exception, isDevelopment);

        return new ErrorResponse
        {
            Title = title,
            Detail = detail,
            Status = statusCode,
            Extensions = isDevelopment ? new Dictionary<string, object?>
            {
                ["exceptionType"] = exception.GetType().Name,
                ["stackTrace"] = exception.StackTrace ?? "N/A"
            } : null
        };
    }

    /// <summary>
    /// Get user-friendly title and detail messages based on status code.
    /// Maps common HTTP status codes to actionable error messages.
    /// </summary>
    private static (string Title, string Detail) GetErrorMessages(
        int statusCode, 
        Exception exception, 
        bool isDevelopment)
    {
        var title = statusCode switch
        {
            400 => "Invalid Request",
            401 => "Session Expired",
            403 => "Access Denied",
            404 => "Not Found",
            429 => "Too Many Requests",
            500 => "Service Temporarily Unavailable",
            503 => "Service Unavailable",
            _ => "An Error Occurred"
        };

        var detail = statusCode switch
        {
            400 => "The request contains invalid data. Please check your input and try again.",
            401 => "Your session has expired. Please sign in again to continue.",
            403 => "You don't have permission to perform this action.",
            404 => "The requested resource was not found.",
            429 => "You've made too many requests. Please wait a moment and try again.",
            500 => isDevelopment 
                ? exception.Message 
                : "An unexpected error occurred. Our team has been notified. Please try again later.",
            503 => "The service is temporarily unavailable. Please try again in a few moments.",
            _ => isDevelopment 
                ? exception.Message 
                : "An unexpected error occurred. Please try again."
        };

        return (title, detail);
    }
}
