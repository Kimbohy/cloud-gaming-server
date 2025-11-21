#include "libretro_addon.h"

#include "libretro_addon.h"

Napi::FunctionReference LibretroAddon::constructor;

Napi::Object LibretroAddon::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "LibretroCore", {
        InstanceMethod("loadCore", &LibretroAddon::LoadCore),
        InstanceMethod("loadGame", &LibretroAddon::LoadGame),
        InstanceMethod("runFrame", &LibretroAddon::RunFrame),
        InstanceMethod("getFrameBuffer", &LibretroAddon::GetFrameBuffer),
        InstanceMethod("getAudioBuffer", &LibretroAddon::GetAudioBuffer),
        InstanceMethod("setInput", &LibretroAddon::SetInput),
        InstanceMethod("getFrameWidth", &LibretroAddon::GetFrameWidth),
        InstanceMethod("getFrameHeight", &LibretroAddon::GetFrameHeight),
        InstanceMethod("clearAudioBuffer", &LibretroAddon::ClearAudioBuffer),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("LibretroCore", func);
    return exports;
}

LibretroAddon::LibretroAddon(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LibretroAddon>(info) {
}

Napi::Value LibretroAddon::LoadCore(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string core_path = info[0].As<Napi::String>().Utf8Value();
    bool result = core.LoadCore(core_path.c_str());

    return Napi::Boolean::New(env, result);
}

Napi::Value LibretroAddon::LoadGame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string rom_path = info[0].As<Napi::String>().Utf8Value();
    bool result = core.LoadGame(rom_path.c_str());

    return Napi::Boolean::New(env, result);
}

Napi::Value LibretroAddon::RunFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    core.RunFrame();
    return env.Undefined();
}

Napi::Value LibretroAddon::GetFrameBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // Make a copy to avoid race condition with VideoRefreshCallback
    auto buffer = core.GetFrameBufferCopy();
    
    if (buffer.empty()) {
        return env.Null();
    }

    return Napi::Buffer<uint8_t>::Copy(env, buffer.data(), buffer.size());
}

Napi::Value LibretroAddon::GetAudioBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    const auto& buffer = core.GetAudioBuffer();
    
    if (buffer.empty()) {
        return env.Null();
    }

    return Napi::Buffer<int16_t>::Copy(env, buffer.data(), buffer.size());
}

Napi::Value LibretroAddon::SetInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsBoolean()) {
        Napi::TypeError::New(env, "Number and Boolean expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    unsigned button = info[0].As<Napi::Number>().Uint32Value();
    bool pressed = info[1].As<Napi::Boolean>().Value();
    
    core.SetInput(button, pressed);
    return env.Undefined();
}

Napi::Value LibretroAddon::GetFrameWidth(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, core.GetFrameWidth());
}

Napi::Value LibretroAddon::GetFrameHeight(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, core.GetFrameHeight());
}

void LibretroAddon::ClearAudioBuffer(const Napi::CallbackInfo& info) {
    core.ClearAudioBuffer();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return LibretroAddon::Init(env, exports);
}

NODE_API_MODULE(libretro_addon, InitAll)
