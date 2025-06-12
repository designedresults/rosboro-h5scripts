const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const isProduction = process.env.NODE_ENV == "production";

const config = {
  entry: {
    MWS068B_ContinuousKilns: "./src/MWS068B_Kilns/ContinuousKilns.ts",    
    MWS068B_BatchKilns: "./src/MWS068B_Kilns/BatchKilns.ts",    
    MWS068B_KilnLocations: "./src/MWS068B_KilnLocations/index.ts",    
    MWS068B_QuickMove: "./src/MWS068B/QuickMove.ts",    
    PPS200A_SearchSupplier: "./src/PPS200A/SearchSupplier.ts",
    PMS050E_LotNumber: "./src/PMS050E/LotNumber.ts",
    PMS050E_CatchWeight: "./src/PMS050E/CatchWeight.ts"
  },
  cache: false,
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "var",
    library: "[name]",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(ts)$/i,
        loader: "ts-loader",
        exclude: ["/node_modules/"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
};

module.exports = () => {
  if (isProduction) {
    config.mode = "production";
  } else {
    config.mode = "development";
  }
  return config;
};
