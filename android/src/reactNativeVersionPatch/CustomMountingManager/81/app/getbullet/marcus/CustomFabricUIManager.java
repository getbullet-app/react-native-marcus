package app.getbullet.marcus;

/*
 * NOTE: This file deliberately stays in Java.
 *
 * Everything it does sits on React Native declarations that are `internal` in Kotlin:
 * `TextLayoutManager` (the measureText call itself), `LayoutMetricsConversions`
 * (getYogaSize / getYogaMeasureMode) and `MountingManager`, which is both a constructor
 * parameter type and a field type here. Java still sees all of them because `internal`
 * stays public in the bytecode; the Kotlin compiler refuses.
 *
 * A Kotlin version would have to smuggle MountingManager as `Any` and delegate the whole
 * method body to a Java helper, which is more indirection for no gain, so the class is
 * left as-is until React Native opens these APIs up.
 */

import static com.facebook.react.fabric.mounting.LayoutMetricsConversions.getYogaMeasureMode;
import static com.facebook.react.fabric.mounting.LayoutMetricsConversions.getYogaSize;

import android.text.SpannableStringBuilder;

import androidx.annotation.Nullable;

import com.facebook.infer.annotation.Assertions;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.mapbuffer.ReadableMapBuffer;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.fabric.mounting.MountingManager;
import com.facebook.react.fabric.mounting.SurfaceMountingManager;
import com.facebook.react.uimanager.ViewManagerRegistry;
import com.facebook.react.uimanager.events.BatchEventDispatchedListener;
import com.facebook.react.views.text.TextLayoutManager;

import java.lang.reflect.Field;

@DoNotStrip
public class CustomFabricUIManager extends FabricUIManager {

  private final ReactApplicationContext mReactApplicationContext;
  private final MountingManager mMountingManager;
  private final MarkdownUtils mMarkdownUtils;

  public CustomFabricUIManager(
    ReactApplicationContext reactContext,
    ViewManagerRegistry viewManagerRegistry,
    BatchEventDispatchedListener batchEventDispatchedListener,
    MountingManager mountingManager,
    ReadableMap markdownProps,
    int parserId
  ) {
    super(reactContext, viewManagerRegistry, batchEventDispatchedListener);

    this.mReactApplicationContext = reactContext;
    this.mMountingManager = mountingManager;

    this.mMarkdownUtils = new MarkdownUtils(reactContext);
    this.mMarkdownUtils.setMarkdownStyle(new MarkdownStyle(markdownProps, reactContext));
    this.mMarkdownUtils.setParserId(parserId);
  }

  @Override
  public long measureText(
    int surfaceId,
    ReadableMapBuffer attributedString,
    ReadableMapBuffer paragraphAttributes,
    float minWidth,
    float maxWidth,
    float minHeight,
    float maxHeight,
    @Nullable float[] attachmentsPositions) {

    ReactContext context;
    if (surfaceId > 0) {
      SurfaceMountingManager surfaceMountingManager =
        mMountingManager.getSurfaceManagerEnforced(surfaceId, "measureText");
      if (surfaceMountingManager.isStopped()) {
        return 0;
      }
      context = surfaceMountingManager.getContext();
      Assertions.assertNotNull(
        context, "Context in SurfaceMountingManager is null. surfaceId: " + surfaceId);
    } else {
      context = mReactApplicationContext;
    }

    return TextLayoutManager.measureText(
      context,
      attributedString,
      paragraphAttributes,
      getYogaSize(minWidth, maxWidth),
      getYogaMeasureMode(minWidth, maxWidth),
      getYogaSize(minHeight, maxHeight),
      getYogaMeasureMode(minHeight, maxHeight),
      spannable -> {
        mMarkdownUtils.applyMarkdownFormatting((SpannableStringBuilder) spannable);
      },
      attachmentsPositions);
  }

  public static FabricUIManager create(FabricUIManager source, ReadableMap markdownProps, int parserId) {
    try {
      MountingManager sourceMountingManager = readPrivateField(source, "mMountingManager");
      ReactApplicationContext reactContext = readPrivateField(source, "mReactApplicationContext");
      ViewManagerRegistry viewManagerRegistry = readPrivateField(source, "mViewManagerRegistry");
      BatchEventDispatchedListener batchEventDispatchedListener = readPrivateField(source, "mBatchEventDispatchedListener");

      FabricUIManager customFabricUIManager = new CustomFabricUIManager(
        reactContext,
        viewManagerRegistry,
        batchEventDispatchedListener,
        sourceMountingManager,
        markdownProps,
        parserId
      );

      return customFabricUIManager;
    } catch (NoSuchFieldException | IllegalAccessException e) {
      throw new RuntimeException("[Marcus] Cannot read data from FabricUIManager", e);
    }
  }

  @SuppressWarnings("unchecked")
  private static <T> T readPrivateField(Object obj, String name) throws NoSuchFieldException, IllegalAccessException {
    Class<?> clazz = obj.getClass();

    Field field;
    try {
      field = clazz.getDeclaredField(name);
    } catch (NoSuchFieldException e) {
      // FabricUIManager is one of the last Java files left in React Native's fabric
      // package. When it is converted to Kotlin these `m`-prefixed names go away, and a
      // bare NoSuchFieldException gives no hint why. Name what we actually found.
      StringBuilder declared = new StringBuilder();
      for (Field candidate : clazz.getDeclaredFields()) {
        if (declared.length() > 0) {
          declared.append(", ");
        }
        declared.append(candidate.getName());
      }
      throw new NoSuchFieldException(
        "[Marcus] "
          + clazz.getName()
          + " has no field '"
          + name
          + "'. React Native most likely renamed it. Declared fields: "
          + declared);
    }
    field.setAccessible(true);
    T value = (T) field.get(obj);

    return value;
  }
}
