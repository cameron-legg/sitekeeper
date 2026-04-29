---
inclusion: always
---

# SiteKeeper — Project Overview

SiteKeeper is a mobile-first contractor management app built with Expo (React Native) + Python Flask + PostgreSQL.

## Stack
- **Frontend**: Expo SDK 54 (React Native), React Navigation 7, TanStack Query, Zustand, Axios
- **Backend**: Python Flask 3.x, SQLAlchemy 2.x, Alembic, flask-bcrypt, PyJWT, flask-cors
- **Database**: PostgreSQL 16 in Docker (dev: port 5434, test: port 5433)
- **Auth**: Email + password via IAuthService interface (pluggable for future OAuth)

## Project structure
```
/
├── backend/          # Flask API
│   ├── app/
│   │   ├── auth/         # IAuthService, EmailPasswordAuthService, auth_required decorator
│   │   ├── blueprints/   # Flask route blueprints (one per resource)
│   │   ├── repositories/ # Repository interfaces + SQLAlchemy implementations
│   │   ├── services/     # Business logic layer (includes ProfileService)
│   │   ├── models.py     # All SQLAlchemy ORM models (User has profile fields)
│   │   ├── extensions.py # db, bcrypt instances
│   │   └── __init__.py   # create_app factory
│   ├── migrations/       # Alembic migration scripts
│   ├── tests/            # pytest test suite
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example      # Copy to .env and set JWT_SECRET
│   └── .flaskenv         # Sets FLASK_APP, host, port automatically
├── frontend/         # Expo app
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts       # Axios with auth + 401 interceptors
│   │   │   ├── hooks/          # TanStack Query hooks per resource
│   │   │   └── types.ts        # Shared API response types
│   │   ├── components/         # Shared components (MarkdownEditor, LineItemEditor)
│   │   ├── navigation/         # RootNavigator, types, navigationRef
│   │   ├── screens/
│   │   │   ├── auth/           # LoginScreen, RegisterScreen
│   │   │   └── app/            # All authenticated screens
│   │   └── store/              # Zustand auth store
│   ├── App.tsx                 # Entry point with registerRootComponent
│   └── .env                    # EXPO_PUBLIC_API_URL (set to LAN IP for device testing)
├── docker-compose.yml
└── README.md
```

## Running the project

### Start databases
```bash
docker compose up -d db
```

### Start backend (from project root)
```bash
source backend/venv/bin/activate
cd backend && flask run
# or without activating: backend/venv/bin/flask run --host=0.0.0.0 --port=5000
```

### Start frontend
```bash
npx expo start --clear   # from frontend/ directory
```

### Physical device testing
Set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5000` in `frontend/.env` and restart Expo with `--clear`.

## Production

- **Live URL**: https://entouch.org
- **Server SSH alias**: `awspantrypix`
- **Deploy script**: `./deploy.sh` (run from project root)
- **Full deployment details**: see `.kiro/steering/deployment.md`

Never commit `backend/.env` or any file containing `JWT_SECRET`. The production `.env` lives only on the server at `/home/sitekeeper/app/backend/.env`.
