package com.heossi.qnsi

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertFalse

class KeyRequestCompatibilityTest {
    @Test
    fun previouslyCompiledConsumerLinksWithoutOldApiAtRuntime() {
        assertNotEquals(LegacyKeyConsumer::class.java.protectionDomain.codeSource.location,
            CreateKeyRequest::class.java.protectionDomain.codeSource.location)
        val metadata = buildJsonObject { put("owner", "customer") }
        val oldDefault = LegacyKeyConsumer.constructWithDefaultMetadata()
        assertNull(oldDefault.metadata)
        assertNull(oldDefault.exportable)
        assertEquals(metadata, LegacyKeyConsumer.constructWithMetadata(metadata).metadata)

        val secured = CreateKeyRequest("ml-dsa-65", "signing", metadata, false, "service")
        for (copy in listOf(LegacyKeyConsumer.copyExplicit(secured), LegacyKeyConsumer.copyDefault(secured), LegacyKeyConsumer.copyAllDefaults(secured))) {
            assertEquals(false, copy.exportable)
            assertEquals("service", copy.custodyEnforcement)
        }
        assertEquals("ml-dsa-87", LegacyKeyConsumer.copyExplicit(secured).algorithm)
        assertEquals("kem", LegacyKeyConsumer.copyDefault(secured).purpose)
        assertEquals(secured, LegacyKeyConsumer.copyAllDefaults(secured))
        assertEquals(listOf("ml-dsa-65", "signing", metadata), LegacyKeyConsumer.components(secured))
    }

    @Test
    fun currentNamedArgumentsCopiesAndSerializationRetainPolicy() {
        val source = CreateKeyRequest(algorithm = "ml-dsa-65", purpose = "signing", exportable = false, custodyEnforcement = "native-worker")
        assertFalse(source.copy(purpose = "kem").exportable!!)
        assertEquals("native-worker", source.copy().custodyEnforcement)
        assertEquals(null, CreateKeyRequest("a", "b", null, false).custodyEnforcement)
        val serialized = Json.encodeToString(CreateKeyRequest.serializer(), source)
        assertEquals(source, Json.decodeFromString(CreateKeyRequest.serializer(), serialized))
    }
}
