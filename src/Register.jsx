import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Register({ setView }) {
  const [form, setForm] = useState({
    nome: "",
    telemovel: "",
    unidade: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage("");
    // Regista no Auth
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if (error) return setMessage(error.message);

    // Guarda dados extra na tabela utilizadores
    const user = data.user;
    const { error: dbError } = await supabase
      .from("utilizadores")
      .insert([
        {
          auth_id: user.id,
          nome: form.nome,
          telemovel: form.telemovel,
          unidade: form.unidade,
        },
      ]);
    if (dbError) setMessage(dbError.message);
    else setMessage("Registo submetido! Aguarde aprovação do comando.");
  };

  return (
    <>
      <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo" />
      <h2>Registar</h2>
      <form onSubmit={handleSubmit}>
        <input
          name="nome"
          type="text"
          placeholder="Nome"
          onChange={handleChange}
          required
        />
        <input
          name="telemovel"
          type="text"
          placeholder="Nº Telemóvel"
          onChange={handleChange}
          required
        />
        <input
          name="unidade"
          type="text"
          placeholder="Unidade"
          onChange={handleChange}
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          onChange={handleChange}
          required
        />
        <button type="submit">Registar</button>
      </form>
      {message && <div className="message">{message}</div>}
      <div className="alt-action">
        Já tenho conta?{" "}
        <button type="button" onClick={() => setView("login")}>
          Login
        </button>
      </div>
    </>
  );
}
