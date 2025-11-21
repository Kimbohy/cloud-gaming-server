#include "libretro_core.h"
#include <dlfcn.h>
#include <cstring>
#include <iostream>

LibretroCore* LibretroCore::instance = nullptr;

LibretroCore::LibretroCore() 
    : core_handle(nullptr), 
      frame_width(0), 
      frame_height(0), 
      frame_pitch(0) {
    instance = this;
    std::memset(input_states, 0, sizeof(input_states));
}

LibretroCore::~LibretroCore() {
    if (core_handle) {
        if (retro_deinit) retro_deinit();
        dlclose(core_handle);
    }
}

bool LibretroCore::LoadCore(const char* core_path) {
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

bool LibretroCore::LoadGame(const char* rom_path) {
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

void LibretroCore::RunFrame() {
    if (retro_run) {
        retro_run();
    }
}

void LibretroCore::SetInput(unsigned button, bool pressed) {
    if (button < 16) {
        input_states[button] = pressed;
    }
}

const std::vector<uint8_t>& LibretroCore::GetFrameBuffer() const {
    return frame_buffer;
}

std::vector<uint8_t> LibretroCore::GetFrameBufferCopy() const {
    return frame_buffer;
}

const std::vector<int16_t>& LibretroCore::GetAudioBuffer() const {
    return audio_buffer;
}

void LibretroCore::ClearAudioBuffer() {
    audio_buffer.clear();
}

unsigned LibretroCore::GetFrameWidth() const { 
    return frame_width; 
}

unsigned LibretroCore::GetFrameHeight() const { 
    return frame_height; 
}

// Static callback implementations
bool LibretroCore::EnvironmentCallback(unsigned cmd, void* data) {
    if (cmd == RETRO_ENVIRONMENT_SET_PIXEL_FORMAT) {
        return true;
    }
    
    if (cmd == RETRO_ENVIRONMENT_GET_CAN_DUPE) {
        bool* can_dupe = (bool*)data;
        *can_dupe = true;
        return true;
    }
    
    return false;
}

void LibretroCore::VideoRefreshCallback(const void* data, unsigned width, unsigned height, size_t pitch) {
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

void LibretroCore::AudioSampleCallback(int16_t left, int16_t right) {
    if (!instance) return;
    instance->audio_buffer.push_back(left);
    instance->audio_buffer.push_back(right);
}

size_t LibretroCore::AudioSampleBatchCallback(const int16_t* data, size_t frames) {
    if (!instance) return 0;
    instance->audio_buffer.insert(instance->audio_buffer.end(), data, data + frames * 2);
    return frames;
}

void LibretroCore::InputPollCallback(void) {
    // Input polling handled externally
}

int16_t LibretroCore::InputStateCallback(unsigned port, unsigned device, unsigned index, unsigned id) {
    if (!instance) return 0;
    if (port != 0 || device != RETRO_DEVICE_JOYPAD) return 0;
    if (id >= 16) return 0;
    
    return instance->input_states[id] ? 1 : 0;
}
