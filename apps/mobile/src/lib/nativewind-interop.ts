import { cssInterop } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * react-native-safe-area-context'in SafeAreaView'ı NativeWind'in varsayılan
 * className desteğine dahil değil (yalnızca RN çekirdek bileşenleri otomatik
 * yamalanır). Bu, className prop'unu style'a çevirir.
 */
cssInterop(SafeAreaView, { className: "style" });
