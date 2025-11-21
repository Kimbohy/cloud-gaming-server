#include <napi.h>
#include <dlfcn.h>
#include <cstring>
#include <vector>
#include <iostream>

// Libretro API types and constants
#define RETRO_DEVICE_JOYPAD 1
#define RETRO_DEVICE_ID_JOYPAD_B 0
#define RETRO_DEVICE_ID_JOYPAD_Y 1
#define RETRO_DEVICE_ID_JOYPAD_SELECT 2
#define RETRO_DEVICE_ID_JOYPAD_START 3
#define RETRO_DEVICE_ID_JOYPAD_UP 4
#define RETRO_DEVICE_ID_JOYPAD_DOWN 5
#define RETRO_DEVICE_ID_JOYPAD_LEFT 6
#define RETRO_DEVICE_ID_JOYPAD_RIGHT 7
#define RETRO_DEVICE_ID_JOYPAD_A 8
#define RETRO_DEVICE_ID_JOYPAD_X 9
#define RETRO_DEVICE_ID_JOYPAD_L 10
#define RETRO_DEVICE_ID_JOYPAD_R 11

// Environment commands
#define RETRO_ENVIRONMENT_SET_PIXEL_FORMAT 10
#define RETRO_ENVIRONMENT_GET_CAN_DUPE 14

// Pixel formats  
#define RETRO_PIXEL_FORMAT_RGB565 2
#define RETRO_PIXEL_FORMAT_XRGB8888 1

typedef void (*retro_init_t)(void);
typedef void (*retro_deinit_t)(void);
typedef void (*retro_set_environment_t)(bool (*)(unsigned, void*));
typedef void (*retro_set_video_refresh_t)(void (*)(const void*, unsigned, unsigned, size_t));
typedef void (*retro_set_audio_sample_t)(void (*)(int16_t, int16_t));
typedef void (*retro_set_audio_sample_batch_t)(size_t (*)(const int16_t*, size_t));
typedef void (*retro_set_input_poll_t)(void (*)(void));
typedef void (*retro_set_input_state_t)(int16_t (*)(unsigned, unsigned, unsigned, unsigned));
typedef bool (*retro_load_game_t)(const void*);
typedef void (*retro_unload_game_t)(void);
typedef void (*retro_run_t)(void);
typedef void (*retro_get_system_av_info_t)(void*);

struct retro_game_info {
    const char* path;
    const void* data;
    size_t size;
    const char* meta;
};

struct retro_system_av_info {
    struct {
        unsigned base_width;
        unsigned base_height;
        unsigned max_width;
        unsigned max_height;
        float aspect_ratio;
    } geometry;
    struct {
        double fps;
        double sample_rate;
    } timing;
};

class LibretroCore {
private:
    void* core_handle;
    retro_init_t retro_init;
    retro_deinit_t retro_deinit;
    retro_set_environment_t retro_set_environment;
    retro_set_video_refresh_t retro_set_video_refresh;
    retro_set_audio_sample_t retro_set_audio_sample;
    retro_set_audio_sample_batch_t retro_set_audio_sample_batch;
    retro_set_input_poll_t retro_set_input_poll;
    retro_set_input_state_t retro_set_input_state;
    retro_load_game_t retro_load_game;
    retro_unload_game_t retro_unload_game;
    retro_run_t retro_run;
    retro_get_system_av_info_t retro_get_system_av_info;

    std::vector<uint8_t> frame_buffer;
    std::vector<int16_t> audio_buffer;
    unsigned frame_width;
    unsigned frame_height;
    size_t frame_pitch;
    bool input_states[16]; // Support for up to 16 buttons

    static LibretroCore* instance;

public:
    LibretroCore() : core_handle(nullptr), frame_width(0), frame_height(0), frame_pitch(0) {
        instance = this;
        std::memset(input_states, 0, sizeof(input_states));
    }

    ~LibretroCore() {
        if (core_handle) {
            if (retro_deinit) retro_deinit();
            dlclose(core_handle);
        }
    }

    bool LoadCore(const char* core_path) {
        core_handle = dlopen(core_path, RTLD_LAZY);
        if (!core_handle) {
            std::cerr << "Failed to load core: " << dlerror() << std::endl;
            return false;
        }

        // Load core functions
        retro_init = (retro_init_t)dlsym(core_handle, "retro_init");
        retro_deinit = (retro_deinit_t)dlsym(core_handle, "retro_deinit");
        retro_set_environment = (retro_set_environment_t)dlsym(core_handle, "retro_set_environment");
        retro_set_video_refresh = (retro_set_video_refresh_t)dlsym(core_handle, "retro_set_video_refresh");
        retro_set_audio_sample = (retro_set_audio_sample_t)dlsym(core_handle, "retro_set_audio_sample");
        retro_set_audio_sample_batch = (retro_set_audio_sample_batch_t)dlsym(core_handle, "retro_set_audio_sample_batch");
        retro_set_input_poll = (retro_set_input_poll_t)dlsym(core_handle, "retro_set_input_poll");
        retro_set_input_state = (retro_set_input_state_t)dlsym(core_handle, "retro_set_input_state");
        retro_load_game = (retro_load_game_t)dlsym(core_handle, "retro_load_game");
        retro_unload_game = (retro_unload_game_t)dlsym(core_handle, "retro_unload_game");
        retro_run = (retro_run_t)dlsym(core_handle, "retro_run");
        retro_get_system_av_info = (retro_get_system_av_info_t)dlsym(core_handle, "retro_get_system_av_info");

        // Set up callbacks
        retro_set_environment(EnvironmentCallback);
        retro_set_video_refresh(VideoRefreshCallback);
        retro_set_audio_sample(AudioSampleCallback);
        retro_set_audio_sample_batch(AudioSampleBatchCallback);
        retro_set_input_poll(InputPollCallback);
        retro_set_input_state(InputStateCallback);

        retro_init();
        return true;
    }

    bool LoadGame(const char* rom_path) {
        retro_game_info game_info;
        game_info.path = rom_path;
        game_info.data = nullptr;
        game_info.size = 0;
        game_info.meta = nullptr;

        if (!retro_load_game(&game_info)) {
            std::cerr << "Failed to load game" << std::endl;
            return false;
        }

        // Get system AV info
        retro_system_av_info av_info;
        retro_get_system_av_info(&av_info);
        
        frame_width = av_info.geometry.base_width;
        frame_height = av_info.geometry.base_height;
        
        std::cout << "Game loaded: " << frame_width << "x" << frame_height 
                  << " @ " << av_info.timing.fps << " fps" << std::endl;

        return true;
    }

    void RunFrame() {
        if (retro_run) {
            retro_run();
        }
    }

    void SetInput(unsigned button, bool pressed) {
        if (button < 16) {
            input_states[button] = pressed;
            std::cout << "[LibretroCore::SetInput] Button " << button << " = " << (pressed ? "PRESSED" : "RELEASED") << std::endl;
            std::cout << "[LibretroCore::SetInput] Current state array: ";
            for (int i = 0; i < 16; i++) {
                if (input_states[i]) std::cout << i << " ";
            }
            std::cout << std::endl;
        }
    }

    const std::vector<uint8_t>& GetFrameBuffer() const {
        return frame_buffer;
    }

    // Thread-safe copy of frame buffer
    std::vector<uint8_t> GetFrameBufferCopy() const {
        return frame_buffer;
    }

    const std::vector<int16_t>& GetAudioBuffer() const {
        return audio_buffer;
    }

    void ClearAudioBuffer() {
        audio_buffer.clear();
    }

    unsigned GetFrameWidth() const { return frame_width; }
    unsigned GetFrameHeight() const { return frame_height; }

private:
    static bool EnvironmentCallback(unsigned cmd, void* data) {
        std::cout << "[EnvironmentCallback] CMD=" << cmd << std::endl;
        
        if (cmd == RETRO_ENVIRONMENT_SET_PIXEL_FORMAT) {
            unsigned* format = (unsigned*)data;
            std::cout << "[EnvironmentCallback] Core requested pixel format: " << *format << std::endl;
            // RETRO_PIXEL_FORMAT_0RGB1555 = 0
            // RETRO_PIXEL_FORMAT_XRGB8888 = 1
            // RETRO_PIXEL_FORMAT_RGB565 = 2
            if (*format == 2) {
                std::cout << "[EnvironmentCallback] Format is RGB565" << std::endl;
            } else if (*format == 1) {
                std::cout << "[EnvironmentCallback] Format is XRGB8888" << std::endl;
            } else if (*format == 0) {
                std::cout << "[EnvironmentCallback] Format is 0RGB1555" << std::endl;
            }
            return true;
        }
        
        if (cmd == RETRO_ENVIRONMENT_GET_CAN_DUPE) {
            bool* can_dupe = (bool*)data;
            *can_dupe = true;
            return true;
        }
        
        return false;
    }

    static void VideoRefreshCallback(const void* data, unsigned width, unsigned height, size_t pitch) {
        if (!instance || !data) return;

        instance->frame_width = width;
        instance->frame_height = height;
        instance->frame_pitch = pitch;

        // Allocate RGBA buffer
        instance->frame_buffer.resize(width * height * 4);
        
        uint8_t* dst = instance->frame_buffer.data();

        // Convert RGB565 to RGBA
        // RGB565: RRRRRGGGGGGBBBBB (16 bits, 2 bytes per pixel)
        for (unsigned y = 0; y < height; y++) {
            const uint16_t* row = (const uint16_t*)((const uint8_t*)data + y * pitch);
            for (unsigned x = 0; x < width; x++) {
                uint16_t pixel = row[x];
                
                // Extract RGB565 components
                uint8_t r5 = (pixel >> 11) & 0x1F;  // 5 bits
                uint8_t g6 = (pixel >> 5) & 0x3F;   // 6 bits
                uint8_t b5 = pixel & 0x1F;          // 5 bits
                
                // Scale to 8-bit (expand to full range)
                uint8_t r8 = (r5 << 3) | (r5 >> 2);
                uint8_t g8 = (g6 << 2) | (g6 >> 4);
                uint8_t b8 = (b5 << 3) | (b5 >> 2);
                
                size_t idx = (y * width + x) * 4;
                dst[idx + 0] = r8;
                dst[idx + 1] = g8;
                dst[idx + 2] = b8;
                dst[idx + 3] = 255;
            }
        }
    }

    static void AudioSampleCallback(int16_t left, int16_t right) {
        if (!instance) return;
        instance->audio_buffer.push_back(left);
        instance->audio_buffer.push_back(right);
    }

    static size_t AudioSampleBatchCallback(const int16_t* data, size_t frames) {
        if (!instance) return 0;
        instance->audio_buffer.insert(instance->audio_buffer.end(), data, data + frames * 2);
        return frames;
    }

    static void InputPollCallback(void) {
        // Input polling handled externally
        // This is called by the core every frame to poll inputs
        static int poll_count = 0;
        poll_count++;
        if (poll_count % 60 == 0) {
            std::cout << "[InputPollCallback] Called " << poll_count << " times" << std::endl;
        }
    }

    static int16_t InputStateCallback(unsigned port, unsigned device, unsigned index, unsigned id) {
        if (!instance) return 0;
        if (port != 0 || device != RETRO_DEVICE_JOYPAD) return 0;
        if (id >= 16) return 0;
        
        bool pressed = instance->input_states[id];
        // Log only when button is pressed to avoid spam
        if (pressed) {
            std::cout << "[InputStateCallback] Button " << id << " is pressed" << std::endl;
        }
        return pressed ? 1 : 0;
    }
};

LibretroCore* LibretroCore::instance = nullptr;

// Node.js wrapper class
class LibretroAddon : public Napi::ObjectWrap<LibretroAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    LibretroAddon(const Napi::CallbackInfo& info);

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
};

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
