#import <RNMarcusSpec/RNMarcusSpec.h>

#import <React/RCTEventEmitter.h>

// Without inheriting after RCTEventEmitter we don't get access to bridge
@interface MarcusModule : RCTEventEmitter <NativeMarcusModuleSpec>

@end
