var path = require("path");
var webpack = require("webpack");
var CopyWebpackPlugin = require("copy-webpack-plugin");
var MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
	cache: true,
	performance: {
		hints: false // Suppresses the asset and bundle size recommendation warnings
	},
	entry: {
		webvowl: "./src/webvowl/js/entry.js",
		"webvowl.app": "./src/app/js/entry.js"
	},
	output: {
		path: path.join(__dirname, "deploy/"),
		publicPath: "",
		filename: "js/[name].js",
		chunkFilename: "js/[chunkhash].js",
		library: {
			name: "[name]",
			type: "assign"
		}
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, "css-loader"]
			}
		]
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{ context: "src/app", from: "data/**/*" }
			]
		}),
		new MiniCssExtractPlugin({
			filename: "css/[name].css"
		}),
		new webpack.ProvidePlugin({
			d3: "d3"
		})
	],
	externals: {
		"d3": "d3"
	}
};
