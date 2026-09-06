const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');
const pages = ['index.html', 'test/phase9-demo.html', 'test/phase10-demo.html', 'test/phase11-demo.html', 'test/phase12-demo.html', 'test/phase13-demo.html', 'test/phase14-demo.html', 'test/phase15-demo.html', 'test/phase16-demo.html', 'test/phase17-demo.html', 'test/phase18-demo.html'].filter(file => fs.existsSync(path.resolve(__dirname, file)));
const pageKey = file => file === 'index.html' ? 'app' : path.basename(file, '.html');

module.exports = {
  mode: 'development',
  entry: Object.fromEntries(pages.map(file => [pageKey(file), `./src/page-entry-loader.cjs!./${file}`])),
  output: {
    filename: '[name].bundle.js',
    publicPath: '/',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  devServer: {
    static: [
      { directory: './dist' },
      { directory: './' },
    ],
    hot: false,
    client: false,
    liveReload: false,
    port: process.env.PORT || 8080,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              name: 'images/[name].[hash:8].[ext]',
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'fonts/[name].[hash:8].[ext]',
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...pages.map(file => new HtmlWebpackPlugin({
      templateContent: () => fs.readFileSync(path.resolve(__dirname, file), 'utf8').replace(/<script\s+type="module"[^>]*>[\s\S]*?<\/script>/g, ''),
      filename: file,
      chunks: [pageKey(file)],
      inject: 'body',
    })),
    new HtmlWebpackPlugin({
      template: './tools/design.html',
      filename: 'tools/design.html',
      inject: false,
    }),
  ],
  optimization: { splitChunks: { chunks: 'all', cacheGroups: { levels: { test: /[\\/]data[\\/]levels[\\/](exp-[^/\\]+|ch\d+)[\\/]/, chunks: 'async', enforce: true, name: module => 'levels-' + module.resource.split(/[/\\]/).slice(-2,-1)[0] } } }, runtimeChunk: 'single' },
  devtool: 'source-map',
};
