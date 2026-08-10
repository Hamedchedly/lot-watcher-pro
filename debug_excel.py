import pandas as pd
import numpy as np

file_path = "/home/ubuntu/upload/Suivi_Travaux_Secteur_ER_HCHEDLY_2023.xlsx"
try:
    # Lire sans header pour voir la structure brute
    df = pd.read_excel(file_path, header=None).head(10)
    for i, row in df.iterrows():
        print(f"Row {i}: {row.tolist()}")
except Exception as e:
    print(f"Erreur : {e}")
