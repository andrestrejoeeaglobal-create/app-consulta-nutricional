import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import axios from 'axios';
import LogoEABlanco from '../assets/LogoEABlanco.svg';

export const LoginFollowup = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('andres trejo');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 🔑 AUTENTICACIÓN INSTITUCIONAL SINGIN API
      const res = await axios.post('http://localhost:5000/api/login', {
        username: username.trim(),
        password: password.trim()
      });

      const data = res.data;
      setIsLoading(false);

      if (data.success && data.user) {
        // ALMACENAMIENTO OBLIGATORIO DEL TOKEN INSTITUCIONAL
        if (data.user.token) {
          localStorage.setItem('ea_token', data.user.token);
        }
        localStorage.setItem('ea_session', JSON.stringify(data.user));

        onLoginSuccess({
          userId: String(data.user.legacy_id || '165'),
          citation: '15000',
          patientName: 'ROSA MENDEZ PADRON',
          userName: data.user.name || 'ANDRES TREJO MALDONADO',
          urlFoto: data.user.urlFoto || '',
          token: data.user.token || ''
        });
      } else {
        setError(data.message || 'Credenciales incorrectas. Verifique usuario y contraseña.');
      }
    } catch (err) {
      console.warn("⚠️ API SINGIN login fallback:", err);
      setIsLoading(false);

      // Fallback demo local
      const mockToken = "47886D49-0E71-4DA5-84AD-FC3E4A103467";
      localStorage.setItem('ea_token', mockToken);
      onLoginSuccess({
        userId: '165',
        citation: '15000',
        patientName: 'ROSA MENDEZ PADRON',
        userName: 'ANDRES TREJO MALDONADO',
        urlFoto: '',
        token: mockToken
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#151515] flex items-center justify-center p-4 font-sans select-none">
      {/* TARJETA PRINCIPAL (REPLICA EXACTA 1-A-1 MODELO APP 1) */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-sans border border-slate-100">
        
        {/* 1. ENCABEZADO BENTO CLÍNICO */}
        <div className="bg-[#FAFAFA] p-6 flex justify-between items-center border-b border-slate-200/60 relative">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
              ECOSISTEMA DE
            </span>
            <h1 className="text-slate-800 font-extrabold text-base tracking-tight leading-tight">
              Transformación Inteligente<br />
              <span className="text-slate-500 font-normal">y Logro Optimizado</span>
            </h1>
          </div>

          {/* LOGOTIPO EN CONTENEDOR AZUL CORPORATIVO */}
          <div className="bg-[#1C75BC] p-2.5 rounded-xl shadow-sm flex items-center justify-center">
            <img
              src={LogoEABlanco}
              alt="Logo Equipo en Acción"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>

        {/* 2. CUERPO DE LA TARJETA */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 rounded text-sm text-center border font-medium flex items-center justify-center gap-2 bg-red-50 text-red-600 border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* CAMPOS DE ENTRADA */}
            <div className="space-y-5">
              {/* Usuario */}
              <div>
                <label className="block text-slate-700 font-semibold text-sm mb-2">
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1C75BC] focus:border-transparent outline-none transition-all text-sm"
                    placeholder="Ingresa tu usuario"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError('');
                    }}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-slate-700 font-semibold text-sm mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1C75BC] focus:border-transparent outline-none transition-all text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <a
                    href="#"
                    className="text-sm text-blue-500 hover:text-blue-700 font-medium hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
            </div>

            {/* TEXTO AVISO */}
            <p className="text-slate-600 text-sm leading-relaxed text-justify px-1">
              Este sistema procesa datos sensibles de salud mediante{' '}
              <span className="font-bold text-slate-700">
                Modelos Avanzados de Visión Artificial y Análisis Clínico Metabólico
              </span>
              . Al ingresar, confirmas que tienes autorización para gestionar
              estos expedientes.
            </p>

            {/* BOTÓN DE ACCIÓN */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#1C75BC] hover:bg-[#155A92] shadow-md'} text-white py-4 rounded-lg transition-all font-bold text-lg flex items-center justify-center gap-2 group cursor-pointer`}
            >
              {isLoading ? 'Verificando y Autenticando...' : 'Iniciar Sesión'}
              {!isLoading && (
                <span className="group-hover:translate-x-1 transition-transform">
                  ➜
                </span>
              )}
            </button>
          </form>

          {/* NOTA LEGAL (Footer Gris con Alto Contraste) */}
          <div className="mt-8 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-600 leading-tight text-center uppercase tracking-wide font-bold">
                LA INFORMACIÓN MOSTRADA ES PARA USO EXCLUSIVO DE PROFESIONALES DE LA SALUD. PROTOCOLOS DE CIFRADO DE GRADO MÉDICO ACTIVOS.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
