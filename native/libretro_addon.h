#ifndef LIBRETRO_ADDON_H
#define LIBRETRO_ADDON_H

#include <napi.h>
#include "libretro_core.h"

class LibretroAddon : public Napi::ObjectWrap<LibretroAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    LibretroAddon(const Napi::CallbackInfo& info);
    ~LibretroAddon();

private:
    static Napi::FunctionReference constructor;
    LibretroCore core;

    Napi::Value LoadCore(const Napi::CallbackInfo& info);
    Napi::Value LoadGame(const Napi::CallbackInfo& info);
    Napi::Value RunFrame(const Napi::CallbackInfo& info);
    Napi::Value GetFrameBuffer(const Napi::CallbackInfo& info);
    Napi::Value GetAudioBuffer(const Napi::CallbackInfo& info);
    Napi::Value SetInput(const Napi::CallbackInfo& info);
    Napi::Value GetFrameWidth(const Napi::CallbackInfo& info);
    Napi::Value GetFrameHeight(const Napi::CallbackInfo& info);
    void ClearAudioBuffer(const Napi::CallbackInfo& info);
    void UnloadGame(const Napi::CallbackInfo& info);
    void UnloadCore(const Napi::CallbackInfo& info);
    Napi::Value IsActive(const Napi::CallbackInfo& info);
};

#endif // LIBRETRO_ADDON_H
