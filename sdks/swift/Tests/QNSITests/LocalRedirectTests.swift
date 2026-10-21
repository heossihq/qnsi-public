#if os(macOS)
import Foundation
import XCTest
@testable import QNSI

/// Real loopback HTTP redirect checks, not live platform acceptance.
final class LocalRedirectTests: XCTestCase {
    func testRedirectsDoNotForwardCredentialsAtAnyBoundary() async throws {
        for phase in ["activation", "service", "retry", "session"] {
            let process = Process()
            let output = Pipe()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.standardOutput = output
            process.arguments = ["python3", "-u", "-c", """
import http.server, json, sys
phase = sys.argv[1]
class Handler(http.server.BaseHTTPRequestHandler):
    received = 0
    service_calls = 0
    def log_message(self, *args):
        pass
    def do_GET(self):
        self.rfile.read(int(self.headers.get('Content-Length', '0')))
        if self.path == '/metrics':
            status, body = 200, json.dumps({'received': Handler.received})
        elif self.path == '/received':
            Handler.received += 1
            status, body = 200, '{}'
        elif self.path == '/billing/v1/sdk/activate' and phase != 'activation':
            status, body = 200, json.dumps({'tenantId': 'test-tenant', 'expiresInSeconds': 3600})
        else:
            Handler.service_calls += 1
            status = 401 if phase == 'retry' and Handler.service_calls == 1 else 307
            body = '{}'
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if status == 307:
            self.send_header('Location', 'http://127.0.0.1:%d/received' % self.server.server_port)
        self.end_headers()
        self.wfile.write(body.encode())
    do_POST = do_GET
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
""", phase]
            try process.run()
            defer {
                process.terminate()
                process.waitUntilExit()
            }
            var portBytes = Data()
            while let byte = try output.fileHandleForReading.read(upToCount: 1), !byte.isEmpty {
                if byte == Data([10]) { break }
                portBytes.append(byte)
            }
            let port = try XCTUnwrap(Int(String(decoding: portBytes, as: UTF8.self)))
            let base = "http://127.0.0.1:\(port)"
            let client = try QnsiClient(apiKey: "test-api-key", baseUrl: base, timeout: 5)
            do {
                switch phase {
                case "activation": try await client.ensureActivated()
                case "session":
                    let transport = try Transport(apiKey: "test-api-key", baseUrl: base, timeout: 5)
                    _ = try await transport.requestJsonSession("POST", "/session", body: .object(["payload": .string("test-data")]), bearer: "test-session", tenantId: "test-tenant")
                default: _ = try await client.kms.listKeys()
                }
                XCTFail("redirect returned success at \(phase)")
            } catch let error as QnsiError {
                XCTAssertEqual(error.statusCode, 307, "\(phase)")
            }
            let metricsURL = try XCTUnwrap(URL(string: base + "/metrics"))
            let (data, _) = try await URLSession.shared.data(from: metricsURL)
            XCTAssertEqual(JSONValue.parse(data)?["received"]?.numberValue, 0, "credentials or payload forwarded at \(phase)")
        }
    }
}
#endif
