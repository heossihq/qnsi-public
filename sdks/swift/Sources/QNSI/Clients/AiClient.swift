import Foundation

private let prefix = "/proxy/ai/v1"

/// AI orchestration: model registry, workloads, inference, artifacts.
/// Wraps ai-orchestrator `/ai/v1`.
public struct AiClient: Sendable {
    let transport: Transport

    // MARK: Model registry

    /// Register a model in the registry.
    public func registerModel(
        name: String,
        version: String,
        provider: String,
        capabilities: [String]? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "name": .string(name),
            "version": .string(version),
            "provider": .string(provider),
        ]
        if let capabilities { object["capabilities"] = .array(capabilities.map { .string($0) }) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/models", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listModels(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/models", options: RequestOptions(query: query))
    }

    public func getModel(modelId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/models/\(modelId)")
    }

    public func updateModel(
        modelId: String,
        body: [String: JSONValue],
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        try await transport.requestJson(
            "PATCH", "\(prefix)/models/\(modelId)", body: .object(body),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func activateModel(modelId: String, idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/models/\(modelId)/activate",
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func deployModel(body: [String: JSONValue], idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/models/deploy", body: .object(body),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    // MARK: Workloads

    /// Submit an AI workload. `type` is one of `"training"`, `"fine-tune"`, `"inference-batch"`.
    public func submitWorkload(
        modelId: String,
        type: String,
        inputRefs: [String]? = nil,
        outputBucket: String? = nil,
        enclaveType: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "modelId": .string(modelId),
            "type": .string(type),
        ]
        if let inputRefs { object["inputRefs"] = .array(inputRefs.map { .string($0) }) }
        if let outputBucket { object["outputBucket"] = .string(outputBucket) }
        if let enclaveType { object["enclaveType"] = .string(enclaveType) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/workloads", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func getWorkload(workloadId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/workloads/\(workloadId)")
    }

    public func listWorkloads(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/workloads", options: RequestOptions(query: query))
    }

    public func cancelWorkload(workloadId: String, idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/workloads/\(workloadId)/cancel",
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    // MARK: Inference

    /// A synchronous inference request. `input` is the model-specific payload.
    public func invokeInference(
        modelId: String,
        input: [String: JSONValue],
        stream: Bool? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "modelId": .string(modelId),
            "input": .object(input),
        ]
        if let stream { object["stream"] = .bool(stream) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/inference", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    // MARK: Artifacts

    /// Register an artifact (model weights, dataset, etc.) referencing a stored object.
    public func registerArtifact(
        name: String,
        hash: String,
        storageId: String,
        type: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "name": .string(name),
            "hash": .string(hash),
            "storageId": .string(storageId),
        ]
        if let type { object["type"] = .string(type) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/artifacts", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }
}
