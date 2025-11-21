#ifndef LIBRETRO_CORE_H
#define LIBRETRO_CORE_H

#include "libretro_types.h"
#include <vector>
#include <cstdint>

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

    // Static callback functions
    static bool EnvironmentCallback(unsigned cmd, void* data);
    static void VideoRefreshCallback(const void* data, unsigned width, unsigned height, size_t pitch);
    static void AudioSampleCallback(int16_t left, int16_t right);
    static size_t AudioSampleBatchCallback(const int16_t* data, size_t frames);
    static void InputPollCallback(void);
    static int16_t InputStateCallback(unsigned port, unsigned device, unsigned index, unsigned id);

public:
    LibretroCore();
    ~LibretroCore();

    bool LoadCore(const char* core_path);
    bool LoadGame(const char* rom_path);
    void RunFrame();
    void SetInput(unsigned button, bool pressed);
    
    const std::vector<uint8_t>& GetFrameBuffer() const;
    std::vector<uint8_t> GetFrameBufferCopy() const;
    const std::vector<int16_t>& GetAudioBuffer() const;
    void ClearAudioBuffer();
    
    unsigned GetFrameWidth() const;
    unsigned GetFrameHeight() const;
};

#endif // LIBRETRO_CORE_H
