package com.heossi.qnsi

/**
 * Base class for every error raised by the QNSP SDK.
 *
 * All QNSP exceptions are unchecked ([RuntimeException]) so Java callers are not
 * forced into `try/catch` boilerplate; catch [QnsiException] to handle any SDK
 * failure uniformly. Mirrors the error taxonomy of the `@heossihq/qnsp` (npm),
 * `qnsp` (PyPI), and Go/Rust SDKs.
 */
public open class QnsiException internal constructor(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/** Network / connectivity failure raised before any HTTP response was received. */
public class QnsiNetworkException internal constructor(
    method: String,
    url: String,
    cause: Throwable?,
) : QnsiException("qnsp: network error calling $method $url", cause)

/** API-key / activation failure (missing key, invalid key, suspended account, rate limited). */
public class QnsiAuthException internal constructor(
    message: String,
    public val code: String? = null,
) : QnsiException("qnsp: auth error${if (code != null) " ($code)" else ""}: $message")

/** A non-2xx response from the QNSP API. [body] is the raw response payload, if any. */
public class QnsiApiException internal constructor(
    message: String,
    public val statusCode: Int,
    public val code: String? = null,
    public val body: String? = null,
) : QnsiException("qnsp: api error $statusCode${if (code != null) " $code" else ""}: $message")

/** Webhook signature verification or parsing failure. */
public class QnsiWebhookException internal constructor(
    message: String,
) : QnsiException("qnsp: webhook error: $message")
