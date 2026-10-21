package com.heossi.qnsi

import kotlinx.serialization.json.JsonObject

// ABI fixture: the three primary fields from the pre-custody request contract.
// Not a shipped SDK implementation; used only to compile the independent consumer.
public data class CreateKeyRequest @JvmOverloads constructor(
    public val algorithm: String,
    public val purpose: String,
    public val metadata: JsonObject? = null,
)
