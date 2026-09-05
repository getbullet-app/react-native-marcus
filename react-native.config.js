module.exports = {
  dependency: {
    platforms: {
      android: {
        // Listed by hand because autolinking skips any component declared
        // `interfaceOnly`, and both of these are. Without this the descriptor is
        // never registered, the decorator falls back to a plain view -- which
        // `display: contents` then flattens away -- and no markdown is applied.
        componentDescriptors: [
          "MarcusTextInputDecoratorViewComponentDescriptor",
          "MarcusTextDecoratorViewComponentDescriptor",
        ],
        cmakeListsPath: "../android/src/main/new_arch/CMakeLists.txt",
      },
    },
  },
}
