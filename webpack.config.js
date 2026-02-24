const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const isProduction = process.env.NODE_ENV == "production";

const config = {
  entry: {
    MWS068B_ContinuousKilns: "./src/MWS068B_Kilns/ContinuousKilns.ts",    
    MWS068B_BatchKilns: "./src/MWS068B_Kilns/BatchKilns.ts",    
    MWS068B_KilnLocations: "./src/MWS068B_KilnLocations/index.ts",    
    MWS068B_ReclassKilns: "./src/MWS068B_Kilns/Reclass.ts",    
    MWS068B_QuickMove: "./src/MWS068B/QuickMove.ts",    
    MWS068B_QuickAdjust: "./src/MWS068B/QuickAdjust.ts",
    MWS068B_ReprintTag: "./src/MWS068B/ReprintTag.ts",
    MWS068B_ReturnFromInfeed: "./src/MWS068B/ReturnFromInfeed.ts",
    MWS068B_CutFromStock: "./src/MWS068B/CutFromStock.ts",        
    PPS200A_SearchSupplier: "./src/PPS200A/SearchSupplier.ts",
    PMS050E_LotNumber: "./src/PMS050E/LotNumber.ts",
    PMS050E_CatchWeight: "./src/PMS050E/CatchWeight.ts",
    PMS260B_LotNumber: "./src/PMS260B/LotNumber.ts",
    PPS300E_CatchWeight: "./src/PPS300E/CatchWeight.ts",
    PMS100F_BatchInfo: "./src/PMS100F/PMS100F_BatchInfo.ts",
    MMS130E_Defaults: "./src/MMS130E/Defaults.ts",
    MMS310E_CatchWeight: "./src/MMS310E/CatchWeight.ts",
    OIS302B1_CutFromStock: "./src/OIS302B1/CutFromStock.ts",
    ATS101G_Camber: "./src/ATS101G/Camber.ts",
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
