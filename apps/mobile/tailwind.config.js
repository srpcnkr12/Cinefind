/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [
    require("nativewind/preset"),
    require("@reelmate/tokens/tailwind-preset.cjs"),
  ],
  theme: {
    extend: {
      // `expo-font`in `loadAsync` çağrısına verilen anahtar adları RN'de fontFamily
      // değeri olarak kullanılır — Google Fonts'un görünen aile adıyla aynı değildir.
      // Bkz. apps/mobile/src/app/_layout.tsx.
      fontFamily: {
        display: ["BigShouldersDisplay_700Bold"],
        body: ["HankenGrotesk_400Regular"],
        "body-semibold": ["HankenGrotesk_600SemiBold"],
      },
    },
  },
  plugins: [],
};
