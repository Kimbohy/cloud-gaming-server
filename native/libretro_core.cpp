#include "libretro_core.h"
#include <dlfcn.h>
#include <cstring>
#include <iostream>

// Static member initialization
std::mutex LibretroCore::global_mutex;
LibretroCore* LibretroCore::active_instance = nullptr;

LibretroCore::LibretroCore() 
    : core_handle(nullptr), 
      frame_width(0), 
      frame_height(0), 
      frame_pitch(0),
      is_active(false),
      game_loaded(false),
      core_loaded(false),
      retro_init(nullptr),
      retro_deinit(nullptr),
      retro_set_environment(nullptr),
      retro_set_video_refresh(nullptr),
      retro_set_audio_sample(nullptr),
      retro_set_audio_sample_batch(nullptr),
      retro_set_input_poll(nullptr),
      retro_set_input_state(nullptr),
      retro_load_game(nullptr),
      retro_unload_game(nullptr),
      retro_run(nullptr),
      retro_get_system_av_info(nullptr) {
    std::memset(input_states, 0, sizeof(input_states));
}

LibretroCore::~LibretroCore() {
    // Ensure proper cleanup order
    UnloadGame();
    UnloadCore();
}

void LibretroCore::UnloadGame() {
    std::lock_guard<std::mutex> lock(global_mutex);
    
    if (game_loaded && retro_unload_game) {
        // Only unload if we are the active instance
        if (active_instance == this) {
            retro_unload_game();
        }
        game_loaded = false;
    }
    
    // Clear buffers
    frame_buffer.clear();
    audio_buffer.clear();
}

void LibretroCore::UnloadCore() {
    std::lock_guard<std::mutex> lock(global_mutex);
    
    // Mark as inactive first
    is_active.store(false);
    
    if (core_loaded && core_handle) {
        // Only call deinit if we are the active instance
        if (active_instance == this) {
            if (retro_deinit) {
                retro_deinit();
            }
            active_instance = nullptr;
        }
        
        dlclose(core_handle);
        core_handle = nullptr;
        core_loaded = false;
    }
    
    // Reset function pointers
    retro_init = nullptr;
    retro_deinit = nullptr;
    retro_set_environment = nullptr;
    retro_set_video_refresh = nullptr;
    retro_set_audio_sample = nullptr;
    retro_set_audio_sample_batch = nullptr;
    retro_set_input_poll = nullptr;
    retro_set_input_state = nullptr;
    retro_load_game = nullptr;
    retro_unload_game = nullptr;
    retro_run = nullptr;
    retro_get_system_av_info = nullptr;
}

bool LibretroCore::LoadCore(const char* core_path) {
    std::lock_guard<std::mutex> lock(global_mutex);
    
    // If there's already an active instance, we need to clean it up first
    if (active_instance && active_instance != this) {
        std::cerr << "Warning: Another core instance is active. Cleaning up..." << std::endl;
        // The old instance should be cleaned up by its owner
        // We'll just take over as the active instance
    }
    
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

    // Set this as the active instance BEFORE setting callbacks
    active_instance = this;
    is_active.store(true);

    // Set up callbacks
    retro_set_environment(EnvironmentCallback);
    retro_set_video_refresh(VideoRefreshCallback);
    retro_set_audio_sample(AudioSampleCallback);
    retro_set_audio_sample_batch(AudioSampleBatchCallback);
    retro_set_input_poll(InputPollCallback);
    retro_set_input_state(InputStateCallback);

    retro_init();
    core_loaded = true;
    return true;
}

bool LibretroCore::LoadGame(const char* rom_path) {
    std::lock_guard<std::mutex> lock(global_mutex);
    
    if (!core_loaded || !is_active.load()) {
        std::cerr << "Core not loaded or not active" << std::endl;
        return false;
    }
    
    // Ensure we're the active instance
    if (active_instance != this) {
        std::cerr << "Not the active instance" << std::endl;
        return false;
    }

    retro_game_info game_info;
    game_info.path = rom_path;
    game_info.data = nullptr;
    game_info.size = 0;
    game_info.meta = nullptr;

    if (!retro_load_game(&game_info)) {
        std::cerr << "Failed to load game" << std::endl;
        return false;
    }

    game_loaded = true;

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
    // Check if we're still active without holding the lock during run
    if (!is_active.load() || !retro_run) {
        return;
    }
    
    // Verify we're the active instance
    if (active_instance != this) {
        return;
    }
    
    retro_run();
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
    LibretroCore* instance = active_instance;
    if (!instance || !instance->is_active.load() || !data) return;

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
    LibretroCore* instance = active_instance;
    if (!instance || !instance->is_active.load()) return;
    instance->audio_buffer.push_back(left);
    instance->audio_buffer.push_back(right);
}

size_t LibretroCore::AudioSampleBatchCallback(const int16_t* data, size_t frames) {
    LibretroCore* instance = active_instance;
    if (!instance || !instance->is_active.load()) return 0;
    instance->audio_buffer.insert(instance->audio_buffer.end(), data, data + frames * 2);
    return frames;
}

void LibretroCore::InputPollCallback(void) {
    // Input polling handled externally
}

int16_t LibretroCore::InputStateCallback(unsigned port, unsigned device, unsigned index, unsigned id) {
    LibretroCore* instance = active_instance;
    if (!instance || !instance->is_active.load()) return 0;
    if (port != 0 || device != RETRO_DEVICE_JOYPAD) return 0;
    if (id >= 16) return 0;
    
    return instance->input_states[id] ? 1 : 0;
}
