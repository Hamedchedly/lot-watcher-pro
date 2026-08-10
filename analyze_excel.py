import pandas as pd
import json

file_path = "/home/ubuntu/upload/Suivi_Travaux_Secteur_ER_HCHEDLY_2023.xlsx"
try:
    df = pd.read_excel(file_path, header=0)
    print("Colonnes trouvées :")
    print(df.columns.tolist())
    print("\nAperçu des 2 premières lignes :")
    print(df.head(2).to_json(orient="records", indent=2))
except Exception as e:
    print(f"Erreur : {e}")
