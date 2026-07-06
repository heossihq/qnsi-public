#include <memory>
#include <string>
#include <vector>

#include <napi.h>
#include <oqs/oqs.h>

namespace {

Napi::Value BufferFrom(Napi::Env env, const uint8_t* data, size_t length) {
	return Napi::Buffer<uint8_t>::Copy(env, data, length);
}

std::vector<uint8_t> BufferToVector(const Napi::Value& value, const std::string& name, size_t expected) {
	if (!value.IsTypedArray() && !value.IsBuffer()) {
		throw Napi::TypeError::New(value.Env(), name + " must be a Buffer or Uint8Array");
	}
	Napi::Buffer<uint8_t> buffer = value.As<Napi::Buffer<uint8_t>>();
	if (buffer.Length() != expected) {
		throw Napi::RangeError::New(value.Env(), name + " must be " + std::to_string(expected) + " bytes");
	}
	return std::vector<uint8_t>(buffer.Data(), buffer.Data() + buffer.Length());
}

class KEMWrapper : public Napi::ObjectWrap<KEMWrapper> {
public:
	static Napi::Function DefineClass(Napi::Env env) {
		return Napi::ObjectWrap<KEMWrapper>::DefineClass(
			env,
			"KEM",
			{
				KEMWrapper::InstanceMethod("generateKeypair", &KEMWrapper::GenerateKeypair),
				KEMWrapper::InstanceMethod("generateKeypairDerand", &KEMWrapper::GenerateKeypairDerand),
				KEMWrapper::InstanceMethod("encapsulate", &KEMWrapper::Encapsulate),
				KEMWrapper::InstanceMethod("encapsulateDerand", &KEMWrapper::EncapsulateDerand),
				KEMWrapper::InstanceMethod("decapsulate", &KEMWrapper::Decapsulate),
				KEMWrapper::InstanceMethod("details", &KEMWrapper::Details),
				KEMWrapper::InstanceMethod("free", &KEMWrapper::Free),
			});
	}

	KEMWrapper(const Napi::CallbackInfo& info)
		: Napi::ObjectWrap<KEMWrapper>(info), kem_(nullptr) {
		if (info.Length() < 1 || !info[0].IsString()) {
			throw Napi::TypeError::New(info.Env(), "Algorithm name required");
		}
		const std::string algorithm = info[0].As<Napi::String>();
		kem_ = OQS_KEM_new(algorithm.c_str());
		if (kem_ == nullptr) {
			throw Napi::Error::New(info.Env(), "OQS_KEM_new failed for algorithm " + algorithm);
		}
	}

	~KEMWrapper() override {
		if (kem_ != nullptr) {
			OQS_KEM_free(kem_);
			kem_ = nullptr;
		}
	}

	Napi::Value GenerateKeypair(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		std::vector<uint8_t> public_key(kem_->length_public_key);
		std::vector<uint8_t> secret_key(kem_->length_secret_key);
		if (OQS_KEM_keypair(kem_, public_key.data(), secret_key.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_KEM_keypair failed");
		}

		Napi::Object result = Napi::Object::New(env);
		result.Set("publicKey", BufferFrom(env, public_key.data(), public_key.size()));
		result.Set("secretKey", BufferFrom(env, secret_key.data(), secret_key.size()));
		return result;
	}

	/**
	 * Deterministic keypair generation from a caller-supplied seed.
	 * Wraps OQS_KEM_keypair_derand from liboqs ≥ 0.10 (kem.h). The seed
	 * length is algorithm-specific and exposed via kem_->length_keypair_seed.
	 *
	 * Intended use: NIST ACVP test-vector validation. Production code SHOULD
	 * call generateKeypair() instead; this method exists to drive deterministic
	 * conformance tests (FIPS 203 keyGen ACVP expects the same seed → same pk+sk).
	 */
	Napi::Value GenerateKeypairDerand(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 1) {
			throw Napi::TypeError::New(env, "seed is required");
		}
		if (kem_->length_keypair_seed == 0) {
			throw Napi::Error::New(env,
				"Algorithm does not expose a deterministic keypair seed length "
				"(length_keypair_seed == 0). The underlying liboqs implementation "
				"may not support derand keypair generation for this parameter set.");
		}
		const auto seed = BufferToVector(info[0], "seed", kem_->length_keypair_seed);

		std::vector<uint8_t> public_key(kem_->length_public_key);
		std::vector<uint8_t> secret_key(kem_->length_secret_key);
		if (OQS_KEM_keypair_derand(kem_, public_key.data(), secret_key.data(), seed.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_KEM_keypair_derand failed");
		}

		Napi::Object result = Napi::Object::New(env);
		result.Set("publicKey", BufferFrom(env, public_key.data(), public_key.size()));
		result.Set("secretKey", BufferFrom(env, secret_key.data(), secret_key.size()));
		return result;
	}

	Napi::Value Encapsulate(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 1) {
			throw Napi::TypeError::New(env, "publicKey is required");
		}
		const auto public_key = BufferToVector(info[0], "publicKey", kem_->length_public_key);

		std::vector<uint8_t> ciphertext(kem_->length_ciphertext);
		std::vector<uint8_t> shared_secret(kem_->length_shared_secret);

		if (OQS_KEM_encaps(kem_, ciphertext.data(), shared_secret.data(), public_key.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_KEM_encaps failed");
		}

		Napi::Object result = Napi::Object::New(env);
		result.Set("ciphertext", BufferFrom(env, ciphertext.data(), ciphertext.size()));
		result.Set("sharedSecret", BufferFrom(env, shared_secret.data(), shared_secret.size()));
		return result;
	}

	/**
	 * Deterministic encapsulation from a caller-supplied seed (randomness).
	 * Wraps OQS_KEM_encaps_derand from liboqs ≥ 0.10. Seed length:
	 * kem_->length_encaps_seed (e.g., 32 bytes for ML-KEM).
	 *
	 * NIST ACVP test-vector use only. Production code MUST call encapsulate()
	 * which draws randomness from the OpenSSL DRBG (see /trust/entropy).
	 */
	Napi::Value EncapsulateDerand(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 2) {
			throw Napi::TypeError::New(env, "publicKey and seed are required");
		}
		if (kem_->length_encaps_seed == 0) {
			throw Napi::Error::New(env,
				"Algorithm does not expose a deterministic encapsulation seed length "
				"(length_encaps_seed == 0). The underlying liboqs implementation "
				"may not support derand encapsulation for this parameter set.");
		}
		const auto public_key = BufferToVector(info[0], "publicKey", kem_->length_public_key);
		const auto seed = BufferToVector(info[1], "seed", kem_->length_encaps_seed);

		std::vector<uint8_t> ciphertext(kem_->length_ciphertext);
		std::vector<uint8_t> shared_secret(kem_->length_shared_secret);

		if (OQS_KEM_encaps_derand(kem_, ciphertext.data(), shared_secret.data(), public_key.data(), seed.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_KEM_encaps_derand failed");
		}

		Napi::Object result = Napi::Object::New(env);
		result.Set("ciphertext", BufferFrom(env, ciphertext.data(), ciphertext.size()));
		result.Set("sharedSecret", BufferFrom(env, shared_secret.data(), shared_secret.size()));
		return result;
	}

	/**
	 * Algorithm-detail introspection. Exposes the OQS_KEM struct length
	 * fields + IND-CCA + NIST claimed-level so callers don't have to
	 * hardcode constants. Closes a common foot-gun: harness code that
	 * assumed ML-KEM-768 ct length was 1088 but had to derive it manually.
	 */
	Napi::Value Details(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		Napi::Object result = Napi::Object::New(env);
		result.Set("algorithm", Napi::String::New(env, kem_->method_name ? kem_->method_name : ""));
		result.Set("algVersion", Napi::String::New(env, kem_->alg_version ? kem_->alg_version : ""));
		result.Set("claimedNistLevel", Napi::Number::New(env, kem_->claimed_nist_level));
		result.Set("indCca", Napi::Boolean::New(env, kem_->ind_cca));
		result.Set("lengthPublicKey", Napi::Number::New(env, static_cast<double>(kem_->length_public_key)));
		result.Set("lengthSecretKey", Napi::Number::New(env, static_cast<double>(kem_->length_secret_key)));
		result.Set("lengthCiphertext", Napi::Number::New(env, static_cast<double>(kem_->length_ciphertext)));
		result.Set("lengthSharedSecret", Napi::Number::New(env, static_cast<double>(kem_->length_shared_secret)));
		result.Set("lengthKeypairSeed", Napi::Number::New(env, static_cast<double>(kem_->length_keypair_seed)));
		result.Set("lengthEncapsSeed", Napi::Number::New(env, static_cast<double>(kem_->length_encaps_seed)));
		return result;
	}

	Napi::Value Decapsulate(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 2) {
			throw Napi::TypeError::New(env, "ciphertext and secretKey are required");
		}
		const auto ciphertext = BufferToVector(info[0], "ciphertext", kem_->length_ciphertext);
		const auto secret_key = BufferToVector(info[1], "secretKey", kem_->length_secret_key);

		std::vector<uint8_t> shared_secret(kem_->length_shared_secret);
		if (OQS_KEM_decaps(kem_, shared_secret.data(), ciphertext.data(), secret_key.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_KEM_decaps failed");
		}

		return BufferFrom(env, shared_secret.data(), shared_secret.size());
	}

	Napi::Value Free(const Napi::CallbackInfo& info) {
		if (kem_ != nullptr) {
			OQS_KEM_free(kem_);
			kem_ = nullptr;
		}
		return info.Env().Undefined();
	}

private:
	OQS_KEM* kem_;
};

class SigWrapper : public Napi::ObjectWrap<SigWrapper> {
public:
	static Napi::Function DefineClass(Napi::Env env) {
		return Napi::ObjectWrap<SigWrapper>::DefineClass(
			env,
			"Sig",
			{
				SigWrapper::InstanceMethod("generateKeypair", &SigWrapper::GenerateKeypair),
				SigWrapper::InstanceMethod("sign", &SigWrapper::Sign),
				SigWrapper::InstanceMethod("verify", &SigWrapper::Verify),
				SigWrapper::InstanceMethod("details", &SigWrapper::Details),
				SigWrapper::InstanceMethod("free", &SigWrapper::Free),
			});
	}

	SigWrapper(const Napi::CallbackInfo& info)
		: Napi::ObjectWrap<SigWrapper>(info), sig_(nullptr) {
		if (info.Length() < 1 || !info[0].IsString()) {
			throw Napi::TypeError::New(info.Env(), "Algorithm name required");
		}
		const std::string algorithm = info[0].As<Napi::String>();
		sig_ = OQS_SIG_new(algorithm.c_str());
		if (sig_ == nullptr) {
			throw Napi::Error::New(info.Env(), "OQS_SIG_new failed for algorithm " + algorithm);
		}
	}

	~SigWrapper() override {
		if (sig_ != nullptr) {
			OQS_SIG_free(sig_);
			sig_ = nullptr;
		}
	}

	Napi::Value GenerateKeypair(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		std::vector<uint8_t> public_key(sig_->length_public_key);
		std::vector<uint8_t> secret_key(sig_->length_secret_key);
		if (OQS_SIG_keypair(sig_, public_key.data(), secret_key.data()) != OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_SIG_keypair failed");
		}

		Napi::Object result = Napi::Object::New(env);
		result.Set("publicKey", BufferFrom(env, public_key.data(), public_key.size()));
		result.Set("secretKey", BufferFrom(env, secret_key.data(), secret_key.size()));
		return result;
	}

	Napi::Value Sign(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 2) {
			throw Napi::TypeError::New(env, "message and privateKey required");
		}
		Napi::Buffer<uint8_t> messageBuffer = info[0].As<Napi::Buffer<uint8_t>>();
		const auto secret_key = BufferToVector(info[1], "privateKey", sig_->length_secret_key);
		size_t signature_len = sig_->length_signature;
		std::vector<uint8_t> signature(signature_len);
		if (OQS_SIG_sign(sig_, signature.data(), &signature_len, messageBuffer.Data(), messageBuffer.Length(), secret_key.data())
				!= OQS_SUCCESS) {
			throw Napi::Error::New(env, "OQS_SIG_sign failed");
		}
		return BufferFrom(env, signature.data(), signature_len);
	}

	Napi::Value Verify(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		if (info.Length() < 3) {
			throw Napi::TypeError::New(env, "message, signature, and publicKey required");
		}
		Napi::Buffer<uint8_t> messageBuffer = info[0].As<Napi::Buffer<uint8_t>>();
		Napi::Buffer<uint8_t> signatureBuffer = info[1].As<Napi::Buffer<uint8_t>>();
		const auto public_key = BufferToVector(info[2], "publicKey", sig_->length_public_key);

		OQS_STATUS status = OQS_SIG_verify(
			sig_,
			messageBuffer.Data(),
			messageBuffer.Length(),
			signatureBuffer.Data(),
			signatureBuffer.Length(),
			public_key.data());

		return Napi::Boolean::New(env, status == OQS_SUCCESS);
	}

	/**
	 * Algorithm-detail introspection for signatures. Mirrors KEMWrapper::Details.
	 * Note: liboqs 0.15.0 does NOT expose OQS_SIG_keypair_derand; the C library
	 * lacks a seed-controlled keypair API for ML-DSA / SLH-DSA. Upstream PR
	 * pending — until then, ACVP signature-keyGen tests are deferred. See
	 * https://qnsi.heossi.com/verify/conformance scopeNotes.
	 */
	Napi::Value Details(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		Napi::Object result = Napi::Object::New(env);
		result.Set("algorithm", Napi::String::New(env, sig_->method_name ? sig_->method_name : ""));
		result.Set("algVersion", Napi::String::New(env, sig_->alg_version ? sig_->alg_version : ""));
		result.Set("claimedNistLevel", Napi::Number::New(env, sig_->claimed_nist_level));
		result.Set("eufCma", Napi::Boolean::New(env, sig_->euf_cma));
		result.Set("sufCma", Napi::Boolean::New(env, sig_->suf_cma));
		result.Set("sigWithCtxSupport", Napi::Boolean::New(env, sig_->sig_with_ctx_support));
		result.Set("lengthPublicKey", Napi::Number::New(env, static_cast<double>(sig_->length_public_key)));
		result.Set("lengthSecretKey", Napi::Number::New(env, static_cast<double>(sig_->length_secret_key)));
		result.Set("lengthSignature", Napi::Number::New(env, static_cast<double>(sig_->length_signature)));
		return result;
	}

	Napi::Value Free(const Napi::CallbackInfo& info) {
		if (sig_ != nullptr) {
			OQS_SIG_free(sig_);
			sig_ = nullptr;
		}
		return info.Env().Undefined();
	}

private:
	OQS_SIG* sig_;
};

Napi::Value GetSupportedKems(const Napi::CallbackInfo& info) {
	auto env = info.Env();
	const size_t count = OQS_KEM_alg_count();
	Napi::Array result = Napi::Array::New(env, count);
	for (size_t i = 0; i < count; ++i) {
		const char* identifier = OQS_KEM_alg_identifier(i);
		if (identifier) {
			result.Set(i, Napi::String::New(env, identifier));
		}
	}
	return result;
}

Napi::Value GetSupportedSignatures(const Napi::CallbackInfo& info) {
	auto env = info.Env();
	const size_t count = OQS_SIG_alg_count();
	Napi::Array result = Napi::Array::New(env, count);
	for (size_t i = 0; i < count; ++i) {
		const char* identifier = OQS_SIG_alg_identifier(i);
		if (identifier) {
			result.Set(i, Napi::String::New(env, identifier));
		}
	}
	return result;
}

Napi::Value IsKemAlgorithmSupported(const Napi::CallbackInfo& info) {
	auto env = info.Env();
	if (info.Length() < 1 || !info[0].IsString()) {
		throw Napi::TypeError::New(env, "Algorithm name required");
	}
	const std::string algorithm = info[0].As<Napi::String>();
	int status = OQS_KEM_alg_is_enabled(algorithm.c_str());
	return Napi::Boolean::New(env, status == 1);
}

Napi::Value IsSignatureAlgorithmSupported(const Napi::CallbackInfo& info) {
	auto env = info.Env();
	if (info.Length() < 1 || !info[0].IsString()) {
		throw Napi::TypeError::New(env, "Algorithm name required");
	}
	const std::string algorithm = info[0].As<Napi::String>();
	int status = OQS_SIG_alg_is_enabled(algorithm.c_str());
	return Napi::Boolean::New(env, status == 1);
}

Napi::Value Version(const Napi::CallbackInfo& info) {
	return Napi::String::New(info.Env(), OQS_version());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set("KEM", KEMWrapper::DefineClass(env));
	exports.Set("Sig", SigWrapper::DefineClass(env));
	exports.Set("getSupportedKems", Napi::Function::New(env, GetSupportedKems));
	exports.Set("getSupportedSignatures", Napi::Function::New(env, GetSupportedSignatures));
	exports.Set("isKemAlgorithmSupported", Napi::Function::New(env, IsKemAlgorithmSupported));
	exports.Set("isSignatureAlgorithmSupported", Napi::Function::New(env, IsSignatureAlgorithmSupported));
	exports.Set("version", Napi::Function::New(env, Version));
	return exports;
}

}  // namespace

NODE_API_MODULE(liboqs_native, Init)

