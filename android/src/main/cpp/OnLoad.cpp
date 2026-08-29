#include <fbjni/fbjni.h>

#include "MarkdownParser.h"
#include "RuntimeDecorator.h"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
  return facebook::jni::initialize(
      vm, [] { bulletpoint::marcus::JMarkdownParser::registerNatives(); });
}

extern "C" JNIEXPORT void JNICALL
Java_app_getbullet_marcus_MarcusModule_injectJSIBindings(JNIEnv *env,
                                                         jobject thiz,
                                                         jlong jsiRuntime) {
  jsi::Runtime &rt = *reinterpret_cast<jsi::Runtime *>(jsiRuntime);
  bulletpoint::marcus::injectJSIBindings(rt);
}
