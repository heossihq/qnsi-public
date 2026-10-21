package com.heossi.qnsi

import kotlinx.serialization.json.JsonObject

public object LegacyKeyConsumer {
    public fun constructWithDefaultMetadata(): CreateKeyRequest = CreateKeyRequest("ml-dsa-65", "signing")
    public fun constructWithMetadata(metadata: JsonObject): CreateKeyRequest = CreateKeyRequest("ml-dsa-65", "signing", metadata)
    public fun copyExplicit(source: CreateKeyRequest): CreateKeyRequest = source.copy("ml-dsa-87", "signing", null)
    public fun copyDefault(source: CreateKeyRequest): CreateKeyRequest = source.copy(purpose = "kem")
    public fun copyAllDefaults(source: CreateKeyRequest): CreateKeyRequest = source.copy()
    public fun components(source: CreateKeyRequest): List<Any?> {
        val (algorithm, purpose, metadata) = source
        return listOf(algorithm, purpose, metadata)
    }
}
