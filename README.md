# Talking Avatar Chat

A React application that provides a chat interface with a talking avatar using Microsoft Cognitive Services.

## Features

- Real-time speech-to-text and text-to-speech capabilities
- Talking avatar visualization
- Support for multiple languages
- Dark mode support
- Responsive design
- Modern UI components

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Azure Speech Service subscription
- Azure OpenAI Service subscription (optional)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/talking-avatar-chat.git
cd talking-avatar-chat
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add your Azure credentials:
```env
VITE_AZURE_SPEECH_KEY=your_speech_key
VITE_AZURE_SPEECH_REGION=your_region
VITE_AZURE_OPENAI_KEY=your_openai_key
VITE_AZURE_OPENAI_ENDPOINT=your_openai_endpoint
VITE_AZURE_OPENAI_DEPLOYMENT=your_deployment_name
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The build output will be in the `dist` directory.

## Project Structure

```
src/
  ├── components/
  │   └── ui/           # UI components
  ├── lib/              # Utility functions
  ├── App.tsx           # Main App component
  ├── Chat.tsx          # Chat component
  ├── main.tsx          # Application entry point
  └── index.css         # Global styles
```

## Technologies Used

- React
- TypeScript
- Vite
- Tailwind CSS
- Microsoft Cognitive Services
- shadcn/ui components

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
