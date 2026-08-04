package com.heossi.qnsi

/*
 * Deprecated pre-rebrand aliases. The product is QNSI; the canonical types are
 * the `Qnsi*` names. These `Qnsp*` typealiases keep source compatibility for
 * consumers written against the pre-rebrand `0.2.x` API and will be removed in a
 * future major release.
 */

@Deprecated("Use QnsiClient", ReplaceWith("QnsiClient"))
public typealias QnspClient = QnsiClient

@Deprecated("Use QnsiException", ReplaceWith("QnsiException"))
public typealias QnspException = QnsiException

@Deprecated("Use QnsiNetworkException", ReplaceWith("QnsiNetworkException"))
public typealias QnspNetworkException = QnsiNetworkException

@Deprecated("Use QnsiAuthException", ReplaceWith("QnsiAuthException"))
public typealias QnspAuthException = QnsiAuthException

@Deprecated("Use QnsiApiException", ReplaceWith("QnsiApiException"))
public typealias QnspApiException = QnsiApiException

@Deprecated("Use QnsiWebhookException", ReplaceWith("QnsiWebhookException"))
public typealias QnspWebhookException = QnsiWebhookException

@Deprecated("Use QnsiWebhookEvent", ReplaceWith("QnsiWebhookEvent"))
public typealias QnspWebhookEvent = QnsiWebhookEvent

@Deprecated("Use QnsiWebhooks", ReplaceWith("QnsiWebhooks"))
public typealias QnspWebhooks = QnsiWebhooks
