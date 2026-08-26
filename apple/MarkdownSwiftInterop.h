#pragma once

// Single entry point for Objective-C++ code that needs the Swift half of the
// module.
//
// The generated Swift interface header references Objective-C types from other
// modules without importing them, so those have to be in scope first. It also
// lands in a different place depending on how the pod is linked: inside the
// framework with use_frameworks!, and in the target's DerivedSources otherwise.

#import <React/RCTBackedTextInputDelegate.h>
#import <React/RCTUITextField.h>
#import <React/RCTUITextView.h>

#import <RNLiveMarkdown/MarkdownRange.h>
#import <RNLiveMarkdown/RCTMarkdownStyle.h>
#import <RNLiveMarkdown/RCTMarkdownUtils.h>

#if __has_include(<RNLiveMarkdown/RNLiveMarkdown-Swift.h>)
#import <RNLiveMarkdown/RNLiveMarkdown-Swift.h>
#else
#import "RNLiveMarkdown-Swift.h"
#endif
