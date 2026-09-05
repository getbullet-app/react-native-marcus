cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

set(LIB_LITERAL RNMarcusSpec)
set(LIB_TARGET_NAME react_codegen_${LIB_LITERAL})

set(LIB_ANDROID_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../..)
set(LIB_CPP_DIR ${LIB_ANDROID_DIR}/../cpp)
set(LIB_CUSTOM_SOURCES_DIR ${LIB_CPP_DIR}/react/renderer/components/${LIB_LITERAL})
set(LIB_ANDROID_GENERATED_JNI_DIR ${LIB_ANDROID_DIR}/build/generated/source/codegen/jni)
set(LIB_ANDROID_GENERATED_COMPONENTS_DIR ${LIB_ANDROID_GENERATED_JNI_DIR}/react/renderer/components/${LIB_LITERAL})

file(GLOB LIB_MODULE_SRCS CONFIGURE_DEPENDS *.cpp react/renderer/components/RNMarcusSpec/*.cpp)
file(GLOB LIB_CUSTOM_SRCS CONFIGURE_DEPENDS ${LIB_CUSTOM_SOURCES_DIR}/*.cpp)
file(GLOB LIB_CODEGEN_SRCS CONFIGURE_DEPENDS ${LIB_ANDROID_GENERATED_COMPONENTS_DIR}/*.cpp)

add_library(
  ${LIB_TARGET_NAME}
  SHARED
    ${LIB_MODULE_SRCS}
    ${LIB_CUSTOM_SRCS}
    ${LIB_CODEGEN_SRCS}
)

target_include_directories(
  ${LIB_TARGET_NAME}
  PUBLIC
    .
    ./react/renderer/components/RNMarcusSpec
    ${LIB_ANDROID_GENERATED_JNI_DIR}
    ${LIB_ANDROID_GENERATED_COMPONENTS_DIR}
    ${LIB_CPP_DIR}
)

find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(
  ${LIB_TARGET_NAME}
  fbjni::fbjni
  ReactAndroid::jsi
  ReactAndroid::reactnative
)

# `ParagraphProps.h`, which the paragraph shadow node pulls in, includes
# `HostPlatformParagraphProps.h` -- a header React Native ships once per
# platform, under an include root the prefab module does not put on the search
# path. Add Android's, or including the paragraph at all fails to compile.
get_target_property(
  REACTNATIVE_INCLUDE_DIRS ReactAndroid::reactnative INTERFACE_INCLUDE_DIRECTORIES
)

foreach(include_dir ${REACTNATIVE_INCLUDE_DIRS})
  set(HOST_PLATFORM_TEXT_DIR
    "${include_dir}/react/renderer/components/text/platform/android"
  )
  if(EXISTS "${HOST_PLATFORM_TEXT_DIR}")
    target_include_directories(${LIB_TARGET_NAME} PRIVATE "${HOST_PLATFORM_TEXT_DIR}")
  endif()
endforeach()

if (ReactAndroid_VERSION_MINOR LESS_EQUAL 80)
  target_compile_options(
    ${LIB_TARGET_NAME}
    PRIVATE
      -DLOG_TAG=\"ReactNative\"
      -fexceptions
      -frtti
      -Wall
      -std=c++20
  )
else()
  target_compile_reactnative_options(${LIB_TARGET_NAME} PRIVATE)
endif()

target_compile_options(
  ${LIB_TARGET_NAME}
  PRIVATE
    -DREACT_NATIVE_MINOR_VERSION=${ReactAndroid_VERSION_MINOR}
)

target_include_directories(
  ${CMAKE_PROJECT_NAME}
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)
