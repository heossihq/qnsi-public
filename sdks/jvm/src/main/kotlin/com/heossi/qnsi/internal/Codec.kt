package com.heossi.qnsi.internal

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import okio.ByteString.Companion.decodeBase64
import okio.ByteString.Companion.toByteString

/** Base64 (standard, padded) via okio - already on the OkHttp classpath, works on JVM and Android API 21+. */
internal fun encodeB64(bytes: ByteArray): String = bytes.toByteString().base64()

/** Decode standard base64; null if the input is not valid base64. */
internal fun decodeB64(b64: String): ByteArray? = b64.decodeBase64()?.toByteArray()

internal fun JsonObject.stringField(name: String): String? =
    (this[name] as? JsonPrimitive)?.contentOrNull

internal fun JsonObject.boolField(name: String): Boolean? =
    (this[name] as? JsonPrimitive)?.booleanOrNull
