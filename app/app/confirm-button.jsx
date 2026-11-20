'use client';

// Botón de formulario que pide confirmación antes de enviar (para acciones que no se deshacen fácil).
export default function ConfirmButton({ message, className, children }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
