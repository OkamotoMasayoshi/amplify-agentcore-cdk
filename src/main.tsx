// 必要なパッケージをインポート
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Amplify } from "aws-amplify";
import { Authenticator, Button, View } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import { translations } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import AuthCallback from "./AuthCallback.tsx";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css';
import "./index.css";

// Amplifyの初期化
Amplify.configure(outputs);

// 認証画面を日本語化
I18n.putVocabularies(translations);
I18n.setLanguage('ja');

// アプリケーションのエントリーポイント（認証付きでレンダリング）
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={
          <Authenticator
            components={{
              SignIn: {
                Footer() {
                  return (
                    <View textAlign="center" padding="1rem">
                      <Button
                        onClick={() => window.location.href = `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRAID_TENANT_ID}/oauth2/v2.0/authorize?client_id=${import.meta.env.VITE_ENTRAID_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(import.meta.env.VITE_REDIRECT_URI)}&scope=${encodeURIComponent('User.Read email profile openid')}&state=aipro-agent-poc&response_mode=query`}
                        variation="link"
                        size="small"
                      >
                        Entra IDでログイン
                      </Button>
                    </View>
                  );
                },
              },
            }}
          >
            <App />
          </Authenticator>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
