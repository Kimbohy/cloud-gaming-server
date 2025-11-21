#ifndef LIBRETRO_TYPES_H
#define LIBRETRO_TYPES_H

#include <cstddef>
#include <cstdint>

// Libretro device types
#define RETRO_DEVICE_JOYPAD 1

// Joypad button IDs
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

// Libretro function pointer types
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

// Libretro data structures
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

#endif // LIBRETRO_TYPES_H
