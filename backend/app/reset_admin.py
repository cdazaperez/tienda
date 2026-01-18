"""
Script para resetear el usuario administrador
Ejecutar: python -m app.reset_admin
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole, RefreshToken


def reset_admin():
    """Resetea o crea el usuario administrador"""
    print("Verificando base de datos...")

    # Crear tablas si no existen
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Buscar usuario admin existente
        admin = db.query(User).filter(
            (User.email == "admin@tienda.com") | (User.username == "admin")
        ).first()

        new_password = "Admin123!"

        if admin:
            print(f"Usuario admin encontrado: {admin.email}")
            print("Reseteando contraseña y desbloqueando cuenta...")

            # Resetear contraseña
            admin.password_hash = get_password_hash(new_password)
            # Desbloquear cuenta
            admin.failed_attempts = 0
            admin.locked_until = None
            admin.is_active = True

            # Revocar todos los refresh tokens
            db.query(RefreshToken).filter(
                RefreshToken.user_id == admin.id
            ).update({"revoked": True})

            db.commit()
            print("\n✅ Usuario admin reseteado exitosamente!")
        else:
            print("Usuario admin no encontrado. Creando nuevo usuario...")

            admin = User(
                email="admin@tienda.com",
                username="admin",
                password_hash=get_password_hash(new_password),
                first_name="Administrador",
                last_name="Sistema",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("\n✅ Usuario admin creado exitosamente!")

        print("\n📋 Credenciales de acceso:")
        print(f"   Email:    admin@tienda.com")
        print(f"   Usuario:  admin")
        print(f"   Password: {new_password}")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    reset_admin()
